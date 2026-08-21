/**
 * IDomainEvent — Marker interface for all domain events.
 *
 * A domain event represents something that happened in the past (past tense:
 * BookingCreated, PaymentSucceeded) and is raised by an AggregateRoot when its
 * state changes. Events are appended to the aggregate's internal list and
 * pulled by the application layer after persistence.
 */
export interface IDomainEvent {
    /** Unique event ID (UUID v7 recommended). */
    readonly eventId: string;

    /** ID of the aggregate that emitted this event. */
    readonly aggregateId: string;

    /** When the event occurred (ISO timestamp). */
    readonly occurredAt: Date;

    /** Routing key used by the event bus (e.g. "booking.created"). */
    readonly eventName: string;

    /** Event schema version (for backward-compatible evolution). */
    readonly version: number;
}
