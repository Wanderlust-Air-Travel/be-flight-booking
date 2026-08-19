import type { IDomainEvent } from '../events/domain-event';

/**
 * AggregateRoot — Base class for all DDD aggregate roots.
 *
 * Aggregates accumulate IDomainEvent instances during their lifetime via
 * `addDomainEvent()` (called from within behavior methods). The application
 * layer pulls the events via `pullDomainEvents()` AFTER the aggregate has been
 * persisted, then writes them to the outbox in the same DB transaction.
 *
 * Notes:
 *  - Events are returned as a readonly shallow copy; mutating the returned
 *    array does not affect the aggregate's internal state.
 *  - `pullDomainEvents()` clears the internal list so events are dispatched
 *    exactly once per state change.
 */
export abstract class AggregateRoot<TId> {
    private _domainEvents: IDomainEvent[] = [];

    protected constructor(protected readonly _id: TId) {}

    /** Aggregate's strongly-typed identifier. */
    get id(): TId {
        return this._id;
    }

    /**
     * Drain all accumulated domain events. Returns a shallow readonly copy
     * so callers cannot mutate the aggregate's internal list.
     */
    pullDomainEvents(): readonly IDomainEvent[] {
        const events = Object.freeze([...this._domainEvents]) as readonly IDomainEvent[];
        this._domainEvents = [];
        return events;
    }

    /**
     * Append a new domain event to this aggregate's internal event list.
     * Called from within the aggregate's behavior methods.
     */
    protected addDomainEvent(event: IDomainEvent): void {
        this._domainEvents.push(event);
    }
}