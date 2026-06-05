import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFareDescriptionRulesTable1764772290710 implements MigrationInterface {
    name = 'AddFareDescriptionRulesTable1764772290710';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create FareDescriptionRules table
        await queryRunner.query(`
            CREATE TABLE FareDescriptionRules (
                id UNIQUEIDENTIFIER NOT NULL 
                    CONSTRAINT PK_FareDescriptionRules PRIMARY KEY DEFAULT NEWID(),
                fare_class_code_pattern VARCHAR(50) NOT NULL,
                cabin_type VARCHAR(20) NOT NULL,
                description_text NVARCHAR(500) NOT NULL,
                status BIT NOT NULL DEFAULT 1,
                display_order INT NOT NULL DEFAULT 0,
                is_active BIT NOT NULL DEFAULT 1,
                is_default BIT NOT NULL DEFAULT 0,
                created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
                updated_at DATETIME2 NULL
            )
        `);

        // Create indexes
        await queryRunner.query(`
            CREATE INDEX IX_FareDescriptionRules_Pattern_CabinType_Active
                ON FareDescriptionRules(fare_class_code_pattern, cabin_type, is_active)
        `);

        await queryRunner.query(`
            CREATE INDEX IX_FareDescriptionRules_CabinType_Order_Active
                ON FareDescriptionRules(cabin_type, display_order, is_active)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes first
        await queryRunner.query(
            'DROP INDEX IF EXISTS IX_FareDescriptionRules_CabinType_Order_Active ON FareDescriptionRules'
        );
        await queryRunner.query(
            'DROP INDEX IF EXISTS IX_FareDescriptionRules_Pattern_CabinType_Active ON FareDescriptionRules'
        );

        // Drop table
        await queryRunner.query('DROP TABLE IF EXISTS FareDescriptionRules');
    }
}
