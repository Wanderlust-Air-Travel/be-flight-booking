import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EmailMessage } from '../../domain/aggregates/email-message.aggregate';
import {
    type IEmailMessageRepository,
    type Page,
    type PageOptions,
} from '../../domain/repositories/email.repository.interface';

/**
 * EmailMessageTypeOrmRepository — Production IEmailMessageRepository.
 *
 * Maps the EmailMessage aggregate to the EmailMessages table. The table
 * is created on first boot by the email microservice's bootstrap hook
 * via the static {@link ensureTable} method below.
 */
@Injectable()
export class EmailMessageTypeOrmRepository implements IEmailMessageRepository {
    constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

    async save(message: EmailMessage): Promise<void> {
        await this.dataSource.query(
            `
            MERGE EmailMessages AS target
            USING (SELECT @0 AS id) AS src
                ON target.id = src.id
            WHEN MATCHED THEN
                UPDATE SET
                    status = @5,
                    sent_at = @6,
                    attempts = @7,
                    last_error = @8
            WHEN NOT MATCHED THEN
                INSERT (id, [to], subject, body, template, status, sent_at, attempts, last_error)
                VALUES (@0, @1, @2, @3, @4, @5, @6, @7, @8);
            `,
            [
                message.id,
                message.to,
                message.subject,
                message.body,
                message.template,
                message.status,
                message.sentAt,
                message.attempts,
                message.lastError,
            ]
        );
    }

    async findById(id: string): Promise<EmailMessage | null> {
        const rows = (await this.dataSource.query(
            `SELECT * FROM EmailMessages WHERE id = @0`,
            [id]
        )) as Record<string, unknown>[];
        const row = rows[0];
        return row ? this.toAggregate(row) : null;
    }

    async findFailed(opts: PageOptions): Promise<Page<EmailMessage>> {
        const offset = (opts.page - 1) * opts.limit;
        const result = (await this.dataSource.query(
            `
            SELECT * FROM EmailMessages
            WHERE status = 'FAILED'
            ORDER BY created_at DESC
            OFFSET @0 ROWS FETCH NEXT @1 ROWS ONLY;
            SELECT COUNT(*) AS total FROM EmailMessages WHERE status = 'FAILED';
            `,
            [offset, opts.limit]
        )) as Record<string, unknown>[][];
        const items = (result[0] as Record<string, unknown>[]).map((r) => this.toAggregate(r));
        const total = Number((result[1] as Record<string, unknown>[])[0]?.total ?? 0);
        return { items, total, page: opts.page, limit: opts.limit };
    }

    async delete(id: string): Promise<void> {
        await this.dataSource.query(`DELETE FROM EmailMessages WHERE id = @0`, [id]);
    }

    private toAggregate(row: Record<string, unknown>): EmailMessage {
        return EmailMessage.rehydrate({
            id: String(row.id),
            to: String(row.to ?? row['to'] ?? ''),
            subject: String(row.subject),
            body: String(row.body),
            template: String(row.template) as 'BOOKING_CONFIRMATION',
            status: String(row.status) as 'PENDING' | 'SENT' | 'FAILED',
            createdAt: new Date(row.created_at as string),
            sentAt: row.sent_at ? new Date(row.sent_at as string) : null,
            attempts: Number(row.attempts ?? 0),
            lastError: row.last_error ? String(row.last_error) : null,
        });
    }

    /**
     * Used by main.email.ts at boot to create the EmailMessages table
     * if it doesn't exist (since synchronize=false is mandatory).
     */
    static async ensureTable(dataSource: DataSource): Promise<void> {
        await dataSource.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='EmailMessages' AND xtype='U')
            CREATE TABLE EmailMessages (
                id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
                [to] VARCHAR(255) NOT NULL,
                subject NVARCHAR(500) NOT NULL,
                body NVARCHAR(MAX) NOT NULL,
                template VARCHAR(50) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                created_at DATETIME2 NOT NULL DEFAULT (SYSDATETIME()),
                sent_at DATETIME2 NULL,
                attempts INT NOT NULL DEFAULT 0,
                last_error NVARCHAR(MAX) NULL
            );
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_EmailMessages_status')
                CREATE INDEX IX_EmailMessages_status ON EmailMessages(status);
        `);
    }
}