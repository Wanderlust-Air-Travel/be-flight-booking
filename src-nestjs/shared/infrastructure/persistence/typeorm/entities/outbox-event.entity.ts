import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * OutboxEvent — Transactional outbox row written by IOutboxWriter.
 *
 * Written in the SAME DB transaction as the aggregate state change so that
 * "state changed" and "event enqueued" are atomic. The OutboxProcessor
 * polls rows where published_at IS NULL and publishes them to the event bus.
 *
 * Schema:
 *  - id: UUID v7
 *  - aggregate_type: short class name (e.g. "Booking")
 *  - aggregate_id: aggregate's ID
 *  - event_type: short class name (e.g. "BookingCreatedEvent")
 *  - routing_key: derived from event.eventName() (e.g. "booking.created")
 *  - payload: JSON-stringified event
 *  - created_at: when row was inserted
 *  - published_at: when processor successfully published (nullable)
 *  - retry_count: number of failed publish attempts
 *  - last_error: last error message (nullable)
 *  - updated_at: when row was last touched (retry)
 */
@Entity({ name: 'OutboxEvents', schema: 'dbo' })
@Index('IX_OutboxEvents_PublishedAt', ['published_at'])
@Index('IX_OutboxEvents_AggregateId', ['aggregate_id'])
export class OutboxEvent {
    @PrimaryColumn('uniqueidentifier')
    id: string;

    @Column({ type: 'varchar', length: 100, nullable: false })
    aggregate_type: string;

    @Column({ type: 'uniqueidentifier', nullable: false })
    aggregate_id: string;

    @Column({ type: 'varchar', length: 100, nullable: false })
    event_type: string;

    @Column({ type: 'varchar', length: 200, nullable: false })
    routing_key: string;

    @Column({ type: 'nvarchar', length: 'max', nullable: false })
    payload: string;

    @CreateDateColumn({ type: 'datetime2', nullable: false, default: () => 'SYSDATETIME()' })
    created_at: Date;

    @Column({ type: 'datetime2', nullable: true })
    published_at: Date | null;

    @Column({ type: 'int', nullable: false, default: 0 })
    retry_count: number;

    @Column({ type: 'nvarchar', length: 'max', nullable: true })
    last_error: string | null;

    @UpdateDateColumn({ type: 'datetime2', nullable: true })
    updated_at: Date | null;
}
