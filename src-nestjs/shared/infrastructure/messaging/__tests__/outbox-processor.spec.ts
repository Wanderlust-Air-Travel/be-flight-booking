import { OutboxProcessor } from '../outbox-processor';

interface StoredRow {
    id: string;
    routing_key: string;
    payload: string;
    published_at: Date | null;
    retry_count: number;
    last_error: string | null;
}

interface RepoStub {
    findUnpublished(limit: number): Promise<StoredRow[]>;
    markPublished(id: string): Promise<void>;
    markFailed(id: string, error: string): Promise<void>;
}

interface BusStub {
    publish: jest.Mock;
    failures: Set<string>;
}

describe('OutboxProcessor', () => {
    let repo: RepoStub;
    let bus: BusStub;
    let processor: OutboxProcessor;

    beforeEach(() => {
        repo = {
            findUnpublished: jest.fn().mockResolvedValue([]),
            markPublished: jest.fn().mockResolvedValue(undefined),
            markFailed: jest.fn().mockResolvedValue(undefined),
        };
        bus = {
            publish: jest.fn().mockResolvedValue(undefined),
            failures: new Set<string>(),
        };
        processor = new OutboxProcessor(repo as any, bus as any, { batchSize: 10, maxRetries: 5 });
    });

    function makeRow(overrides: Partial<StoredRow> = {}): StoredRow {
        return {
            id: 'row-1',
            routing_key: 'booking.created',
            payload: JSON.stringify({ eventId: 'e1', aggregateId: 'a1' }),
            published_at: null,
            retry_count: 0,
            last_error: null,
            ...overrides,
        };
    }

    it('processBatch() returns 0 when no unpublished rows', async () => {
        const processed = await processor.processBatch();
        expect(processed).toBe(0);
        expect(repo.findUnpublished).toHaveBeenCalledWith(10);
        expect(bus.publish).not.toHaveBeenCalled();
    });

    it('processBatch() publishes all unpublished rows via bus', async () => {
        const rows = [
            makeRow({ id: 'row-1' }),
            makeRow({ id: 'row-2', routing_key: 'payment.succeeded' }),
        ];
        repo.findUnpublished.mockResolvedValue(rows);
        const processed = await processor.processBatch();
        expect(processed).toBe(2);
        expect(bus.publish).toHaveBeenCalledTimes(2);
        expect(repo.markPublished).toHaveBeenCalledWith('row-1');
        expect(repo.markPublished).toHaveBeenCalledWith('row-2');
    });

    it('processBatch() preserves routing key when publishing', async () => {
        const rows = [
            makeRow({
                id: 'r1',
                routing_key: 'booking.created',
                payload: JSON.stringify({
                    eventId: 'e1',
                    aggregateId: 'a1',
                    eventName: 'booking.created',
                }),
            }),
            makeRow({
                id: 'r2',
                routing_key: 'payment.succeeded',
                payload: JSON.stringify({
                    eventId: 'e2',
                    aggregateId: 'a2',
                    eventName: 'payment.succeeded',
                }),
            }),
        ];
        repo.findUnpublished.mockResolvedValue(rows);
        await processor.processBatch();
        // bus.publish(event, options) — first arg is the event; adapter derives routing key from event.eventName
        expect(bus.publish.mock.calls[0][0].eventName).toBe('booking.created');
        expect(bus.publish.mock.calls[1][0].eventName).toBe('payment.succeeded');
    });

    it('processBatch() marks row as failed (does not throw) when bus.publish throws', async () => {
        const rows = [makeRow({ id: 'row-bad' })];
        repo.findUnpublished.mockResolvedValue(rows);
        bus.publish.mockRejectedValueOnce(new Error('RabbitMQ unavailable'));
        const processed = await processor.processBatch();
        expect(processed).toBe(0); // not counted as success
        expect(repo.markFailed).toHaveBeenCalledWith('row-bad', 'RabbitMQ unavailable');
        expect(repo.markPublished).not.toHaveBeenCalled();
    });

    it('processBatch() continues processing remaining rows after one fails', async () => {
        const rows = [
            makeRow({ id: 'fail-1' }),
            makeRow({ id: 'ok-1' }),
            makeRow({ id: 'fail-2' }),
        ];
        repo.findUnpublished.mockResolvedValue(rows);
        bus.publish
            .mockRejectedValueOnce(new Error('err 1'))
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error('err 2'));
        const processed = await processor.processBatch();
        expect(processed).toBe(1); // only ok-1 succeeded
        expect(repo.markFailed).toHaveBeenCalledWith('fail-1', 'err 1');
        expect(repo.markPublished).toHaveBeenCalledWith('ok-1');
        expect(repo.markFailed).toHaveBeenCalledWith('fail-2', 'err 2');
    });

    it('processBatch() respects batchSize option', async () => {
        processor = new OutboxProcessor(repo as any, bus as any, { batchSize: 3, maxRetries: 5 });
        await processor.processBatch();
        expect(repo.findUnpublished).toHaveBeenCalledWith(3);
    });

    it('processBatch() rejects rows whose retry_count >= maxRetries (poison pill)', async () => {
        processor = new OutboxProcessor(repo as any, bus as any, { batchSize: 10, maxRetries: 2 });
        const rows = [
            makeRow({
                id: 'poison',
                retry_count: 2,
                payload: JSON.stringify({
                    eventId: 'ep',
                    aggregateId: 'ap',
                    eventName: 'poison.evt',
                }),
            }),
            makeRow({
                id: 'fresh',
                retry_count: 0,
                payload: JSON.stringify({
                    eventId: 'ef',
                    aggregateId: 'af',
                    eventName: 'fresh.evt',
                }),
            }),
        ];
        repo.findUnpublished.mockResolvedValue(rows);
        await processor.processBatch();
        // The poison row is skipped (not republished). markFailed with poison message.
        expect(bus.publish).toHaveBeenCalledTimes(1);
        expect(bus.publish.mock.calls[0][0].eventName).toBe('fresh.evt');
        // Poison row logged via markFailed
        expect(repo.markFailed).toHaveBeenCalledWith('poison', expect.stringContaining('poison'));
        // Fresh row was published + marked published
        expect(repo.markPublished).toHaveBeenCalledWith('fresh');
    });

    it('serialization: payload is parsed back to JSON before publishing', async () => {
        const payload = JSON.stringify({
            eventId: 'e1',
            aggregateId: 'a1',
            eventName: 'booking.created',
            occurredAt: new Date('2026-01-01').toISOString(),
            version: 1,
        });
        const rows = [makeRow({ id: 'r1', payload })];
        repo.findUnpublished.mockResolvedValue(rows);
        await processor.processBatch();
        const arg = bus.publish.mock.calls[0][0];
        expect(typeof arg).toBe('object');
        expect(arg.eventId).toBe('e1');
        expect(arg.aggregateId).toBe('a1');
    });

    it('does not lose events when bus throws (row stays unpublished)', async () => {
        const rows = [makeRow({ id: 'r1', retry_count: 0 })];
        repo.findUnpublished.mockResolvedValue(rows);
        bus.publish.mockRejectedValueOnce(new Error('RabbitMQ down'));
        await processor.processBatch();
        // markPublished must NOT be called
        expect(repo.markPublished).not.toHaveBeenCalled();
        // markFailed is called to update retry_count
        expect(repo.markFailed).toHaveBeenCalledWith('r1', 'RabbitMQ down');
    });
});
