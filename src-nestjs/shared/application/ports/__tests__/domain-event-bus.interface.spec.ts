import type { IDomainEvent } from '../../../domain/events/domain-event';
import type { IDomainEventBus } from '../domain-event-bus.interface';

/**
 * InMemoryEventBus — Test double for IDomainEventBus.
 * Used in contract tests; production code uses RabbitMQEventBus.
 */
class InMemoryEventBus implements IDomainEventBus {
    public published: IDomainEvent[] = [];

    async publish(event: IDomainEvent): Promise<void> {
        this.published.push(event);
    }

    async publishAll(events: readonly IDomainEvent[]): Promise<void> {
        for (const e of events) await this.publish(e);
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

describe('IDomainEventBus contract', () => {
    let bus: InMemoryEventBus;

    beforeEach(() => {
        bus = new InMemoryEventBus();
    });

    it('publish() accepts a single IDomainEvent', async () => {
        const event = new FakeEvent('evt-1', 'agg-1', new Date(), 'test.event', 1);
        await bus.publish(event);
        expect(bus.published).toHaveLength(1);
        expect(bus.published[0]).toBe(event);
    });

    it('publishAll() publishes all events in order', async () => {
        const events = [
            new FakeEvent('evt-1', 'agg-1', new Date(), 'a.created', 1),
            new FakeEvent('evt-2', 'agg-1', new Date(), 'a.updated', 1),
        ];
        await bus.publishAll(events);
        expect(bus.published).toEqual(events);
    });

    it('returns Promise<void> from both methods', () => {
        const event = new FakeEvent('evt-1', 'agg-1', new Date(), 'test', 1);
        const p1 = bus.publish(event);
        const p2 = bus.publishAll([event]);
        expect(p1).toBeInstanceOf(Promise);
        expect(p2).toBeInstanceOf(Promise);
    });

    it('publishing same event twice does not throw (idempotency at consumer level)', async () => {
        const event = new FakeEvent('evt-1', 'agg-1', new Date(), 'test', 1);
        await bus.publish(event);
        await bus.publish(event);
        expect(bus.published).toHaveLength(2);
    });

    it('preserves eventName() value for routing-key derivation by adapter', async () => {
        const event = new FakeEvent('evt-1', 'agg-1', new Date(), 'booking.created', 1);
        await bus.publish(event);
        expect(bus.published[0].eventName).toBe('booking.created');
    });
});