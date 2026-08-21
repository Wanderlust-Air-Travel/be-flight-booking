import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import type { IOutboxWriter } from '../../../application/ports/outbox-writer.interface';
import type { IDomainEvent } from '../../../domain/events/domain-event';
import { OutboxEvent } from './entities/outbox-event.entity';

/**
 * TypeOrmOutboxWriter — Production IOutboxWriter backed by SQL Server.
 *
 * Appends rows to OutboxEvents table. If an EntityManager is supplied
 * (e.g. from an open queryRunner transaction), the row participates in
 * that transaction; otherwise a default repo.save is used.
 *
 * Uses Node's built-in crypto.randomUUID() to avoid the uuid package's
 * ESM compatibility issue with ts-jest.
 */
@Injectable()
export class TypeOrmOutboxWriter implements IOutboxWriter {
    constructor(@InjectRepository(OutboxEvent) private readonly repo: Repository<OutboxEvent>) {}

    async append(event: IDomainEvent, entityManager?: EntityManager): Promise<void> {
        const row = this.toRow(event);
        if (entityManager) {
            await entityManager.save(OutboxEvent, row);
        } else {
            await this.repo.save(row);
        }
    }

    async appendMany(
        events: readonly IDomainEvent[],
        entityManager?: EntityManager
    ): Promise<void> {
        const rows = events.map((e) => this.toRow(e));
        if (entityManager) {
            await entityManager.save(OutboxEvent, rows);
        } else {
            await this.repo.save(rows);
        }
    }

    private toRow(event: IDomainEvent): OutboxEvent {
        const row = new OutboxEvent();
        row.id = randomUUID();
        row.aggregate_type = (event as any).constructor?.name ?? 'UnknownAggregate';
        row.aggregate_id = event.aggregateId;
        row.event_type = event.constructor?.name ?? 'UnknownEvent';
        row.routing_key = event.eventName;
        row.payload = JSON.stringify(this.serialize(event));
        row.retry_count = 0;
        return row;
    }

    private serialize(event: IDomainEvent): Record<string, unknown> {
        return {
            eventId: event.eventId,
            aggregateId: event.aggregateId,
            occurredAt: event.occurredAt.toISOString(),
            eventName: event.eventName,
            version: event.version,
            payload: (event as any).payload ?? {},
        };
    }
}
