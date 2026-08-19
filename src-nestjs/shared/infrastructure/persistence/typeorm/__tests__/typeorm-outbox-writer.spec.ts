import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { IDomainEvent } from '../../../domain/events/domain-event';
import { OutboxEvent } from '../entities/outbox-event.entity';
import { TypeOrmOutboxWriter } from '../typeorm-outbox-writer';

class FakeEvent implements IDomainEvent {
    constructor(
        public readonly eventId: string,
        public readonly aggregateId: string,
        public readonly occurredAt: Date,
        public readonly eventName: string,
        public readonly version: number,
        public readonly payload: Record<string, unknown>
    ) {}
}

describe('TypeOrmOutboxWriter', () => {
    let writer: TypeOrmOutboxWriter;
    let repo: { save: jest.Mock; manager: any };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TypeOrmOutboxWriter,
                {
                    provide: getRepositoryToken(OutboxEvent),
                    useValue: {
                        save: jest.fn().mockResolvedValue(undefined),
                        manager: undefined,
                    },
                },
            ],
        }).compile();
        writer = module.get(TypeOrmOutboxWriter);
        repo = module.get(getRepositoryToken(OutboxEvent));
    });

    it('append() saves one row to OutboxEvents', async () => {
        const event = new FakeEvent(
            'e1',
            'agg-1',
            new Date('2026-08-19'),
            'booking.created',
            1,
            { foo: 'bar' }
        );
        await writer.append(event);
        expect(repo.save).toHaveBeenCalledTimes(1);
        const saved = repo.save.mock.calls[0][0];
        expect(saved.aggregate_type).toBe('FakeEvent');
        expect(saved.aggregate_id).toBe('agg-1');
        expect(saved.event_type).toBe('FakeEvent');
        expect(saved.routing_key).toBe('booking.created');
        expect(saved.retry_count).toBe(0);
        expect(typeof saved.id).toBe('string');
        expect(saved.id.length).toBeGreaterThan(0);
    });

    it('append() serializes payload as JSON string', async () => {
        const event = new FakeEvent(
            'e1',
            'agg-1',
            new Date('2026-08-19'),
            'booking.created',
            1,
            { pnrCode: 'ABC123' }
        );
        await writer.append(event);
        const saved = repo.save.mock.calls[0][0];
        const parsed = JSON.parse(saved.payload);
        expect(parsed.eventId).toBe('e1');
        expect(parsed.aggregateId).toBe('agg-1');
        expect(parsed.eventName).toBe('booking.created');
        expect(parsed.payload).toEqual({ pnrCode: 'ABC123' });
    });

    it('append() uses EntityManager when provided (transactional write)', async () => {
        const fakeManager = { save: jest.fn().mockResolvedValue(undefined) };
        const event = new FakeEvent('e1', 'a1', new Date(), 'x.y', 1, {});
        await writer.append(event, fakeManager as any);
        expect(fakeManager.save).toHaveBeenCalledWith(OutboxEvent, expect.any(Object));
        expect(repo.save).not.toHaveBeenCalled();
    });

    it('appendMany() saves all events', async () => {
        const events = [
            new FakeEvent('e1', 'a1', new Date(), 'a.created', 1, {}),
            new FakeEvent('e2', 'a1', new Date(), 'a.updated', 1, {}),
        ];
        await writer.appendMany(events);
        expect(repo.save).toHaveBeenCalledTimes(1);
        const savedRows = repo.save.mock.calls[0][0];
        expect(Array.isArray(savedRows)).toBe(true);
        expect(savedRows).toHaveLength(2);
        expect(savedRows[0].routing_key).toBe('a.created');
        expect(savedRows[1].routing_key).toBe('a.updated');
    });

    it('preserves event.occurredAt through serialization', async () => {
        const occurredAt = new Date('2026-08-19T10:00:00.000Z');
        const event = new FakeEvent('e1', 'a1', occurredAt, 'x.y', 1, {});
        await writer.append(event);
        const saved = repo.save.mock.calls[0][0];
        const parsed = JSON.parse(saved.payload);
        expect(parsed.occurredAt).toBe('2026-08-19T10:00:00.000Z');
    });
});