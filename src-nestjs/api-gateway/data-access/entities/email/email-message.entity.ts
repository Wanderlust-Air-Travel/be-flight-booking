import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * EmailMessageRecord — Persistence shape for EmailMessage aggregate.
 *
 * Stored in EmailMessages table. Created on-the-fly by the email-ms
 * microservice the first time it boots. Mirrors the aggregate's fields
 * 1:1; no FK constraints to other contexts because emails are a leaf.
 */
@Entity({ name: 'EmailMessages', schema: 'dbo' })
export class EmailMessageRecord {
    @PrimaryColumn('uniqueidentifier')
    id: string;

    @Column({ type: 'varchar', length: 255, nullable: false })
    @Index()
    to: string;

    @Column({ type: 'nvarchar', length: 500, nullable: false })
    subject: string;

    @Column({ type: 'nvarchar', length: 'MAX', nullable: false })
    body: string;

    @Column({ type: 'varchar', length: 50, nullable: false })
    template: string;

    @Column({ type: 'varchar', length: 20, nullable: false, default: () => "'PENDING'" })
    status: string;

    @CreateDateColumn({ type: 'datetime2', nullable: false, default: () => 'SYSDATETIME()' })
    created_at: Date;

    @Column({ type: 'datetime2', nullable: true })
    sent_at: Date | null;

    @Column({ type: 'int', nullable: false, default: 0 })
    attempts: number;

    @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
    last_error: string | null;
}
