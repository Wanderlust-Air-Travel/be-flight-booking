import type { IDomainEvent } from '../../domain/events/domain-event';

/**
 * IDomainEventBus — Port (interface) for publishing domain events.
 *
 * Application layer calls this from command handlers AFTER persisting the
 * aggregate. The infrastructure adapter (RabbitMQEventBus, InMemoryEventBus
 * for tests) implements this contract.
 *
 * Conventions:
 *  - Implementations MUST publish events in the order received.
 *  - publishAll() may be more efficient than calling publish() in a loop.
 *  - At-least-once delivery is acceptable; consumers must be idempotent.
 */
export interface IDomainEventBus {
    /** Publish a single domain event. */
    publish(event: IDomainEvent): Promise<void>;

    /** Publish multiple domain events in order. */
    publishAll(events: readonly IDomainEvent[]): Promise<void>;
}
