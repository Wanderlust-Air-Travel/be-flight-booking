import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Allow document_number to be NULL for CHD and INF passengers.
 * ADT (adult) still require document number; frontend only sends it for ADT.
 */
export class AllowNullDocumentNumberPassengers1764772400000 implements MigrationInterface {
    name = 'AllowNullDocumentNumberPassengers1764772400000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE dbo.Passengers
            ALTER COLUMN document_number VARCHAR(50) NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Optional: revert to NOT NULL (may fail if there are NULLs in the table)
        await queryRunner.query(`
            ALTER TABLE dbo.Passengers
            ALTER COLUMN document_number VARCHAR(50) NOT NULL
        `);
    }
}
