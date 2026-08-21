import type { EntityManager } from 'typeorm';
import type { IDomainEvent } from '../../domain/events/domain-event';

/**
 * IOutboxWriter — Port (interface) for appending domain events to the
 * outbox table within the SAME database transaction as the aggregate.
 *
 * The application layer calls this AFTER `aggregateRepo.save(aggregate)`
 * but BEFORE `queryRunner.commitTransaction()`. If the transaction
 * commits, the outbox row is committed too — guaranteeing at-least-once
 * delivery. A separate poller drains unpublished rows and publishes them
 * to the event bus.
 *
 * The entityManager parameter allows the writer to participate in an
 * existing transaction (TypeORM's EntityManager pattern).
 */
export interface IOutboxWriter {
    /**
     * Append a single domain event to the outbox.
     * @param event - The domain event to enqueue
     * @param entityManager - Optional TypeORM EntityManager for transactional writes
     */
    append(event: IDomainEvent, entityManager?: EntityManager): Promise<void>;

    /**
     * Append multiple domain events in order.
     */
    appendMany(events: readonly IDomainEvent[], entityManager?: EntityManager): Promise<void>;
}
