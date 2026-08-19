import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { OutboxEvent } from './entities/outbox-event.entity';
import { IOutboxRepository, OutboxRow } from '../../messaging/outbox-processor';

/**
 * TypeOrmOutboxRepository — Production IOutboxRepository backed by SQL Server.
 * Used by OutboxProcessor to drain the OutboxEvents table.
 */
@Injectable()
export class TypeOrmOutboxRepository implements IOutboxRepository {
    constructor(
        @InjectRepository(OutboxEvent) private readonly repo: Repository<OutboxEvent>
    ) {}

    async findUnpublished(limit: number): Promise<OutboxRow[]> {
        const rows = await this.repo.find({
            where: { published_at: IsNull() },
            take: limit,
            order: { created_at: 'ASC' },
        });
        return rows.map((r) => this.toRow(r));
    }

    async markPublished(id: string): Promise<void> {
        await this.repo.update({ id }, { published_at: new Date(), last_error: null });
    }

    async markFailed(id: string, error: string): Promise<void> {
        // Use raw query because we want atomic increment + update
        await this.repo
            .createQueryBuilder()
            .update(OutboxEvent)
            .set({
                retry_count: () => 'retry_count + 1',
                last_error: error,
                updated_at: new Date(),
            })
            .where('id = :id', { id })
            .execute();
    }

    private toRow(entity: OutboxEvent): OutboxRow {
        return {
            id: entity.id,
            routing_key: entity.routing_key,
            payload: entity.payload,
            published_at: entity.published_at,
            retry_count: entity.retry_count,
            last_error: entity.last_error,
        };
    }
}