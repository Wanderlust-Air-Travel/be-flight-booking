import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReservationsTable1734567890000 implements MigrationInterface {
    name = 'AddReservationsTable1734567890000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create Reservations table
        await queryRunner.query(`
            CREATE TABLE Reservations (
                reservation_id UNIQUEIDENTIFIER NOT NULL 
                    CONSTRAINT PK_Reservations PRIMARY KEY,
                    -- Note: Application code must generate UUID v7 for reservation_id
                reservation_code VARCHAR(6) NOT NULL UNIQUE,
                user_id UNIQUEIDENTIFIER NULL,
                
                -- Segments stored as JSON (supports multi-segment for round-trip)
                segments_json NVARCHAR(MAX) NOT NULL, -- JSON array of segments
                
                number_of_passengers INT NOT NULL,
                total_amount DECIMAL(12,2) NOT NULL,
                currency_code CHAR(3) NOT NULL,
                
                status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending/expired/converted/cancelled
                expires_at DATETIME2 NOT NULL,
                created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
                converted_at DATETIME2 NULL, -- When booking is created from this reservation
                
                CONSTRAINT FK_Reservations_Users 
                    FOREIGN KEY (user_id) REFERENCES Users(user_id),
                CONSTRAINT FK_Reservations_Currencies 
                    FOREIGN KEY (currency_code) REFERENCES Currencies(currency_code)
            )
        `);

        // Create indexes for Reservations
        await queryRunner.query(`
            CREATE INDEX IX_Reservations_UserId
                ON Reservations(user_id)
        `);

        await queryRunner.query(`
            CREATE INDEX IX_Reservations_Code
                ON Reservations(reservation_code)
        `);

        await queryRunner.query(`
            CREATE INDEX IX_Reservations_Status
                ON Reservations(status)
        `);

        await queryRunner.query(`
            CREATE INDEX IX_Reservations_ExpiresAt
                ON Reservations(expires_at)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes first
        await queryRunner.query('DROP INDEX IF EXISTS IX_Reservations_ExpiresAt ON Reservations');
        await queryRunner.query('DROP INDEX IF EXISTS IX_Reservations_Status ON Reservations');
        await queryRunner.query('DROP INDEX IF EXISTS IX_Reservations_Code ON Reservations');
        await queryRunner.query('DROP INDEX IF EXISTS IX_Reservations_UserId ON Reservations');

        // Drop table
        await queryRunner.query('DROP TABLE IF EXISTS Reservations');
    }
}
