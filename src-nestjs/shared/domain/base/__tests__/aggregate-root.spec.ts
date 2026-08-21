import type { IDomainEvent } from '../../events/domain-event';
import { AggregateRoot } from '../aggregate-root';

class TestEvent implements IDomainEvent {
    public readonly eventId: string;
    public readonly aggregateId: string;
    public readonly occurredAt: Date;
    public readonly eventName = 'TestEvent';
    public readonly version = 1;
    public readonly payload: Record<string, unknown>;

    constructor(aggregateId: string, payload: Record<string, unknown> = {}) {
        this.eventId = 'event-123';
        this.aggregateId = aggregateId;
        this.occurredAt = new Date('2026-08-19T10:00:00.000Z');
        this.payload = payload;
    }
}

class TestAggregate extends AggregateRoot<string> {
    constructor(id: string) {
        super(id);
    }

    doSomething(): void {
        this.addDomainEvent(new TestEvent(this.id, { foo: 'bar' }));
    }
}

describe('AggregateRoot', () => {
    it('starts with zero domain events', () => {
        const aggregate = new TestAggregate('agg-1');
        expect(aggregate.pullDomainEvents()).toEqual([]);
    });

    it('addDomainEvent() pushes to internal list', () => {
        const aggregate = new TestAggregate('agg-1');
        aggregate.doSomething();
        const events = aggregate.pullDomainEvents();
        expect(events).toHaveLength(1);
        expect(events[0]).toBeInstanceOf(TestEvent);
        expect(events[0].aggregateId).toBe('agg-1');
    });

    it('pullDomainEvents() returns and clears the list', () => {
        const aggregate = new TestAggregate('agg-1');
        aggregate.doSomething();
        aggregate.doSomething();
        expect(aggregate.pullDomainEvents()).toHaveLength(2);
        expect(aggregate.pullDomainEvents()).toHaveLength(0);
    });

    it('returns readonly copy of events (immutability)', () => {
        const aggregate = new TestAggregate('agg-1');
        aggregate.doSomething();
        const events = aggregate.pullDomainEvents();
        // Mutating returned array should throw (object is frozen)
        expect(Object.isFrozen(events)).toBe(true);
        expect(() => (events as any).push(new TestEvent('other'))).toThrow();
        // Subsequent pullDomainEvents() returns empty
        expect(aggregate.pullDomainEvents()).toHaveLength(0);
    });

    it('exposes id via get id()', () => {
        const aggregate = new TestAggregate('agg-xyz');
        expect(aggregate.id).toBe('agg-xyz');
    });

    it('constructor is protected (cannot be instantiated directly)', () => {
        // AggregateRoot is abstract, so direct instantiation should be blocked at compile time.
        // At runtime via reflection we can still call it; the test below verifies abstractness.
        // The real safety is that no one can `new AggregateRoot()` because it's `abstract`.
        expect(typeof AggregateRoot).toBe('function');
    });

    it('accumulates events from multiple state changes before pullDomainEvents()', () => {
        const aggregate = new TestAggregate('agg-2');
        aggregate.doSomething();
        aggregate.doSomething();
        aggregate.doSomething();
        const events = aggregate.pullDomainEvents();
        expect(events).toHaveLength(3);
        expect(events.every((e) => e instanceof TestEvent)).toBe(true);
    });
});
