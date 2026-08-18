import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAirlinesTable1765000000000 implements MigrationInterface {
    name = 'CreateAirlinesTable1765000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE Airlines (
                airline_id UNIQUEIDENTIFIER NOT NULL
                    CONSTRAINT PK_Airlines PRIMARY KEY,
                iata_code CHAR(2) NOT NULL
                    CONSTRAINT UQ_Airlines_IataCode UNIQUE,
                icao_code CHAR(3) NULL
                    CONSTRAINT UQ_Airlines_IcaoCode UNIQUE,
                name NVARCHAR(150) NOT NULL,
                callsign NVARCHAR(50) NULL,
                country NVARCHAR(100) NULL
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS Airlines');
    }
}
