import { Injectable, Logger } from '@nestjs/common';
import type { IDomainEvent } from '../../domain/events/domain-event';
import type { IDomainEventBus } from '../../application/ports/domain-event-bus.interface';

/**
 * IOutboxRepository — Port for the storage layer of the outbox.
 * Allows the processor to remain decoupled from TypeORM.
 */
export interface IOutboxRepository {
    /** Fetch rows where published_at IS NULL, up to `limit`. */
    findUnpublished(limit: number): Promise<OutboxRow[]>;

    /** Mark a row as successfully published. */
    markPublished(id: string): Promise<void>;

    /** Mark a row as failed (increments retry_count, stores last_error). */
    markFailed(id: string, error: string): Promise<void>;
}

export interface OutboxRow {
    id: string;
    routing_key: string;
    payload: string;
    published_at: Date | null;
    retry_count: number;
    last_error: string | null;
}

export interface OutboxProcessorOptions {
    /** Max rows to publish per batch. */
    batchSize: number;
    /** Max retries before a row is treated as a poison pill. */
    maxRetries: number;
}

/**
 * OutboxProcessor — Drains the OutboxEvents table and publishes rows
 * via the IDomainEventBus. Designed to be invoked on a cron schedule
 * (every 5s in production) or on demand for tests.
 *
 * Semantics:
 *  - Each row is published at-most-once-per-batch (rows are still in the
 *    table after a failed publish, so subsequent batches will retry).
 *  - Rows with retry_count >= maxRetries are skipped (poison pill).
 *  - Failures are recorded via markFailed(); successes via markPublished().
 *  - Errors during the bus call are caught per-row so one bad row doesn't
 *    block the rest of the batch.
 */
@Injectable()
export class OutboxProcessor {
    private readonly logger = new Logger(OutboxProcessor.name);

    constructor(
        private readonly repo: IOutboxRepository,
        private readonly bus: IDomainEventBus,
        private readonly options: OutboxProcessorOptions
    ) {}

    /**
     * Process one batch. Returns the number of rows successfully published.
     */
    async processBatch(): Promise<number> {
        const rows = await this.repo.findUnpublished(this.options.batchSize);
        if (rows.length === 0) return 0;

        let processed = 0;
        for (const row of rows) {
            if (row.retry_count >= this.options.maxRetries) {
                this.logger.warn(
                    `Skipping poison-pill outbox row ${row.id} (retry_count=${row.retry_count}, maxRetries=${this.options.maxRetries})`
                );
                await this.repo.markFailed(row.id, `poison: exceeded max retries ${this.options.maxRetries}`);
                continue;
            }

            try {
                const event = this.deserialize(row.payload);
                await this.bus.publish(event, { correlationId: row.id });
                await this.repo.markPublished(row.id);
                processed++;
            } catch (error: any) {
                const message = error?.message ?? String(error);
                this.logger.error(
                    `Outbox publish failed for row ${row.id} (retry_count=${row.retry_count}): ${message}`
                );
                await this.repo.markFailed(row.id, message);
            }
        }
        return processed;
    }

    private deserialize(payload: string): IDomainEvent {
        // The payload is a JSON string with all IDomainEvent public fields.
        // We reconstruct a minimal object that satisfies the IDomainEvent
        // interface; consumers should not depend on the event being a specific
        // class instance (DDD convention: events are immutable data).
        const data = JSON.parse(payload);
        return {
            eventId: data.eventId,
            aggregateId: data.aggregateId,
            occurredAt: new Date(data.occurredAt),
            eventName: data.eventName,
            version: data.version ?? 1,
            ...data,
        } as IDomainEvent;
    }
}