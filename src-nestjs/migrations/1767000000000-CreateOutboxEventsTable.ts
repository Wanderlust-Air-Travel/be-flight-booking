import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CreateOutboxEventsTable — Transactional outbox for DDD domain events.
 *
 * Written in the same transaction as aggregate state changes by
 * TypeOrmOutboxWriter. Drained by OutboxProcessor via cron (every 5s).
 * Replaces the 3x RabbitMQ-down→direct-TCP fallback anti-pattern.
 */
export class CreateOutboxEventsTable1767000000000 implements MigrationInterface {
    name = 'CreateOutboxEventsTable1767000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE OutboxEvents (
                id UNIQUEIDENTIFIER NOT NULL
                    CONSTRAINT PK_OutboxEvents PRIMARY KEY,
                aggregate_type VARCHAR(100) NOT NULL,
                aggregate_id UNIQUEIDENTIFIER NOT NULL,
                event_type VARCHAR(100) NOT NULL,
                routing_key VARCHAR(200) NOT NULL,
                payload NVARCHAR(MAX) NOT NULL,
                created_at DATETIME2 NOT NULL
                    CONSTRAINT DF_OutboxEvents_CreatedAt DEFAULT (SYSDATETIME()),
                published_at DATETIME2 NULL,
                retry_count INT NOT NULL
                    CONSTRAINT DF_OutboxEvents_RetryCount DEFAULT (0),
                last_error NVARCHAR(MAX) NULL,
                updated_at DATETIME2 NULL
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IX_OutboxEvents_PublishedAt
                ON OutboxEvents (published_at)
                WHERE published_at IS NULL
        `);

        await queryRunner.query(`
            CREATE INDEX IX_OutboxEvents_AggregateId
                ON OutboxEvents (aggregate_id)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS OutboxEvents');
    }
}
