import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdatePaymentTables1734600000000 implements MigrationInterface {
    name = 'UpdatePaymentTables1734600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add is_active column to PaymentMethods table
        await queryRunner.query(`
            ALTER TABLE PaymentMethods
            ADD is_active BIT NOT NULL DEFAULT 1
        `);

        // Add idempotency_key and expires_at columns to Payments table
        await queryRunner.query(`
            ALTER TABLE Payments
            ADD idempotency_key VARCHAR(100) NULL
        `);

        await queryRunner.query(`
            ALTER TABLE Payments
            ADD expires_at DATETIME2 NULL
        `);

        // Create index on idempotency_key for faster lookups
        await queryRunner.query(`
            CREATE INDEX IX_Payments_IdempotencyKey
                ON Payments(idempotency_key)
                WHERE idempotency_key IS NOT NULL
        `);

        // Create index on expires_at for cleanup queries
        await queryRunner.query(`
            CREATE INDEX IX_Payments_ExpiresAt
                ON Payments(expires_at)
                WHERE expires_at IS NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes first
        await queryRunner.query(`DROP INDEX IF EXISTS IX_Payments_ExpiresAt ON Payments`);
        await queryRunner.query(`DROP INDEX IF EXISTS IX_Payments_IdempotencyKey ON Payments`);

        // Remove columns from Payments table
        await queryRunner.query(`
            ALTER TABLE Payments
            DROP COLUMN IF EXISTS expires_at
        `);

        await queryRunner.query(`
            ALTER TABLE Payments
            DROP COLUMN IF EXISTS idempotency_key
        `);

        // Remove is_active column from PaymentMethods table
        await queryRunner.query(`
            ALTER TABLE PaymentMethods
            DROP COLUMN IF EXISTS is_active
        `);
    }
}

