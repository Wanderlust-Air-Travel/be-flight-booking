import type { EntityManager } from 'typeorm';
import type { IDomainEvent } from '../../../domain/events/domain-event';
import type { IOutboxWriter } from '../outbox-writer.interface';

/**
 * InMemoryOutboxWriter — Test double for IOutboxWriter.
 * Stores rows in memory so contract tests can verify calls.
 */
interface OutboxRow {
    event: IDomainEvent;
    routingKey: string;
    entityManager?: EntityManager;
}

class InMemoryOutboxWriter implements IOutboxWriter {
    public rows: OutboxRow[] = [];

    async append(event: IDomainEvent, entityManager?: EntityManager): Promise<void> {
        this.rows.push({ event, routingKey: event.eventName, entityManager });
    }

    async appendMany(events: readonly IDomainEvent[], entityManager?: EntityManager): Promise<void> {
        for (const event of events) await this.append(event, entityManager);
    }
}

class FakeEvent implements IDomainEvent {
    constructor(
        public readonly eventId: string,
        public readonly aggregateId: string,
        public readonly occurredAt: Date,
        public readonly eventName: string,
        public readonly version: number
    ) {}
}

describe('IOutboxWriter contract', () => {
    let outbox: InMemoryOutboxWriter;

    beforeEach(() => {
        outbox = new InMemoryOutboxWriter();
    });

    it('append() stores a single event with derived routing key', async () => {
        const event = new FakeEvent('evt-1', 'agg-1', new Date(), 'booking.created', 1);
        await outbox.append(event);
        expect(outbox.rows).toHaveLength(1);
        expect(outbox.rows[0].routingKey).toBe('booking.created');
        expect(outbox.rows[0].event).toBe(event);
    });

    it('appendMany() stores multiple events in order', async () => {
        const events = [
            new FakeEvent('evt-1', 'agg-1', new Date(), 'a.created', 1),
            new FakeEvent('evt-2', 'agg-1', new Date(), 'a.updated', 1),
        ];
        await outbox.appendMany(events);
        expect(outbox.rows.map((r) => r.routingKey)).toEqual(['a.created', 'a.updated']);
    });

    it('append() accepts optional EntityManager for transactional writes', async () => {
        const event = new FakeEvent('evt-1', 'agg-1', new Date(), 'test', 1);
        // We pass undefined as EntityManager because we don't have a real one in unit tests;
        // the production adapter will accept a real TypeORM EntityManager.
        await outbox.append(event, undefined);
        expect(outbox.rows[0].entityManager).toBeUndefined();
    });

    it('preserves full event payload (idempotent serialization check)', async () => {
        const event = new FakeEvent('evt-1', 'agg-1', new Date('2026-01-01'), 'x.y', 1);
        await outbox.append(event);
        expect(outbox.rows[0].event.aggregateId).toBe('agg-1');
        expect(outbox.rows[0].event.eventName).toBe('x.y');
        expect(outbox.rows[0].event.occurredAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });

    it('returns Promise<void> from both methods', () => {
        const event = new FakeEvent('evt-1', 'agg-1', new Date(), 'test', 1);
        const p1 = outbox.append(event);
        const p2 = outbox.appendMany([event]);
        expect(p1).toBeInstanceOf(Promise);
        expect(p2).toBeInstanceOf(Promise);
    });
});