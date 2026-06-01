import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1700000000000 implements MigrationInterface {
    name = 'InitialSchema1700000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 0. USERS / PASSENGERS
        await queryRunner.query(`
            CREATE TABLE Users (
                user_id UNIQUEIDENTIFIER NOT NULL 
                    CONSTRAINT PK_Users PRIMARY KEY,
                fullname NVARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
                updated_at DATETIME2 NULL,
                refresh_token VARCHAR(255) NULL,
                refresh_token_expires_at DATETIME2 NULL,
                forgot_password_token VARCHAR(255) NULL,
                forgot_password_token_expires_at DATETIME2 NULL,
                is_active BIT NOT NULL DEFAULT 1
            )
        `);

        await queryRunner.query(`
            CREATE TABLE Passengers (
                passenger_id UNIQUEIDENTIFIER NOT NULL 
                    CONSTRAINT PK_Passengers PRIMARY KEY,
                user_id UNIQUEIDENTIFIER NULL,
                fullname NVARCHAR(100) NOT NULL,
                dob DATE NOT NULL,
                gender NVARCHAR(10) NOT NULL,
                document_number VARCHAR(50) NOT NULL,
                loyalty_number VARCHAR(50) NULL,
                created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
                CONSTRAINT FK_Passengers_Users
                    FOREIGN KEY (user_id) REFERENCES Users(user_id)
            )
        `);

        // 1. AIRPORTS & ROUTES
        await queryRunner.query(`
            CREATE TABLE Airports (
                airport_id UNIQUEIDENTIFIER NOT NULL
                    CONSTRAINT PK_Airports PRIMARY KEY,
                iata_code CHAR(3) NOT NULL UNIQUE,
                icao_code CHAR(4) NULL,
                name NVARCHAR(150) NOT NULL,
                city NVARCHAR(100) NOT NULL,
                country NVARCHAR(100) NOT NULL,
                timezone VARCHAR(50) NOT NULL
            )
        `);

        await queryRunner.query(`
            CREATE TABLE Routes (
                route_id UNIQUEIDENTIFIER NOT NULL
                    CONSTRAINT PK_Routes PRIMARY KEY,
                origin_airport_id UNIQUEIDENTIFIER NOT NULL,
                destination_airport_id UNIQUEIDENTIFIER NOT NULL,
                distance_km INT NULL,
                is_domestic BIT NOT NULL DEFAULT 1,
                image_url NVARCHAR(300) NULL,
                service_link NVARCHAR(255) NULL,
                created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
                CONSTRAINT CK_Routes_ImageUrl_Format
                    CHECK (
                        image_url IS NULL 
                        OR (
                            image_url LIKE '/images/routes/%.jpg'
                            AND LEN(image_url) = 55
                            AND SUBSTRING(image_url, 16, 36) = CAST(route_id AS VARCHAR(36))
                        )
                    ),
                CONSTRAINT CK_Routes_ServiceLink_Format
                    CHECK (
                        service_link IS NULL 
                        OR (
                            service_link LIKE '/service/%'
                            AND LEN(service_link) = 45
                            AND SUBSTRING(service_link, 10, 36) = CAST(route_id AS VARCHAR(36))
                        )
                    ),
                CONSTRAINT FK_Routes_OriginAirport
                    FOREIGN KEY (origin_airport_id) REFERENCES Airports(airport_id),
                CONSTRAINT FK_Routes_DestinationAirport
                    FOREIGN KEY (destination_airport_id) REFERENCES Airports(airport_id),
                CONSTRAINT UQ_Routes_Origin_Destination
                    UNIQUE (origin_airport_id, destination_airport_id)
            )
        `);

        // Trigger: Auto-generate image_url and service_link
        await queryRunner.query(`
            CREATE TRIGGER trg_Routes_AutoGenerateImageLink
            ON Routes
            AFTER INSERT, UPDATE
            AS
            BEGIN
                SET NOCOUNT ON;
                UPDATE r
                SET 
                    image_url = CASE 
                        WHEN r.image_url IS NULL 
                            OR r.image_url NOT LIKE '/images/routes/%.jpg'
                            OR LEN(r.image_url) != 55
                            OR SUBSTRING(r.image_url, 16, 36) != CAST(r.route_id AS VARCHAR(36))
                        THEN '/images/routes/' + CAST(r.route_id AS VARCHAR(36)) + '.jpg'
                        ELSE r.image_url
                    END,
                    service_link = CASE 
                        WHEN r.service_link IS NULL 
                            OR r.service_link NOT LIKE '/service/%'
                            OR LEN(r.service_link) != 45
                            OR SUBSTRING(r.service_link, 10, 36) != CAST(r.route_id AS VARCHAR(36))
                        THEN '/service/' + CAST(r.route_id AS VARCHAR(36))
                        ELSE r.service_link
                    END
                FROM Routes r
                INNER JOIN inserted i ON r.route_id = i.route_id
                WHERE 
                    r.image_url IS NULL 
                    OR r.service_link IS NULL
                    OR r.image_url NOT LIKE '/images/routes/%.jpg'
                    OR LEN(r.image_url) != 55
                    OR SUBSTRING(r.image_url, 16, 36) != CAST(r.route_id AS VARCHAR(36))
                    OR r.service_link NOT LIKE '/service/%'
                    OR LEN(r.service_link) != 45
                    OR SUBSTRING(r.service_link, 10, 36) != CAST(r.route_id AS VARCHAR(36))
            END
        `);

        // 2. AIRCRAFT TYPES / AIRCRAFTS / SEAT CONFIGURATIONS
        await queryRunner.query(`
            CREATE TABLE AircraftTypes (
                aircraft_type_id UNIQUEIDENTIFIER NOT NULL
                    CONSTRAINT PK_AircraftTypes PRIMARY KEY,
                code VARCHAR(20) NOT NULL UNIQUE,
                manufacturer NVARCHAR(100) NOT NULL,
                model NVARCHAR(100) NOT NULL,
                total_seats INT NOT NULL
            )
        `);

        await queryRunner.query(`
            CREATE TABLE Aircrafts (
                aircraft_id UNIQUEIDENTIFIER NOT NULL
                    CONSTRAINT PK_Aircrafts PRIMARY KEY,
                aircraft_type_id UNIQUEIDENTIFIER NOT NULL,
                registration VARCHAR(20) NOT NULL UNIQUE,
                in_service BIT NOT NULL DEFAULT 1,
                CONSTRAINT FK_Aircrafts_AircraftTypes
                    FOREIGN KEY (aircraft_type_id) REFERENCES AircraftTypes(aircraft_type_id)
            )
        `);

        await queryRunner.query(`
            CREATE TABLE CabinClasses (
                cabin_class_code VARCHAR(5) NOT NULL
                    CONSTRAINT PK_CabinClasses PRIMARY KEY,
                name NVARCHAR(50) NOT NULL
            )
        `);

        await queryRunner.query(`
            CREATE TABLE FareClasses (
                fare_class_code VARCHAR(5) NOT NULL
                    CONSTRAINT PK_FareClasses PRIMARY KEY,
                cabin_class_code VARCHAR(5) NOT NULL,
                description NVARCHAR(200) NULL,
                change_rule NVARCHAR(500) NULL,
                refund_rule NVARCHAR(500) NULL,
                CONSTRAINT FK_FareClasses_CabinClasses
                    FOREIGN KEY (cabin_class_code) REFERENCES CabinClasses(cabin_class_code)
            )
        `);

        await queryRunner.query(`
            CREATE TABLE SeatConfigurations (
                seat_config_id UNIQUEIDENTIFIER NOT NULL
                    CONSTRAINT PK_SeatConfigurations PRIMARY KEY,
                aircraft_type_id UNIQUEIDENTIFIER NOT NULL,
                seat_number VARCHAR(10) NOT NULL,
                cabin_class_code VARCHAR(5) NOT NULL,
                seat_type VARCHAR(20) NULL,
                is_exit_row BIT NOT NULL DEFAULT 0,
                CONSTRAINT FK_SeatConfigurations_AircraftTypes
                    FOREIGN KEY (aircraft_type_id) REFERENCES AircraftTypes(aircraft_type_id),
                CONSTRAINT FK_SeatConfigurations_CabinClasses
                    FOREIGN KEY (cabin_class_code) REFERENCES CabinClasses(cabin_class_code),
                CONSTRAINT UQ_SeatConfigurations_AircraftType_SeatNumber
                    UNIQUE (aircraft_type_id, seat_number)
            )
        `);

        // 3. FLIGHT SCHEDULES & INSTANCES
        await queryRunner.query(`
            CREATE TABLE FlightSchedules (
                flight_schedule_id UNIQUEIDENTIFIER NOT NULL
                    CONSTRAINT PK_FlightSchedules PRIMARY KEY,
                flight_number VARCHAR(10) NOT NULL,
                route_id UNIQUEIDENTIFIER NOT NULL,
                aircraft_type_id UNIQUEIDENTIFIER NOT NULL,
                departure_time_local TIME NOT NULL,
                arrival_time_local TIME NOT NULL,
                operating_days CHAR(7) NOT NULL,
                effective_from DATE NOT NULL,
                effective_to DATE NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'active',
                CONSTRAINT FK_FlightSchedules_Routes
                    FOREIGN KEY (route_id) REFERENCES Routes(route_id),
                CONSTRAINT FK_FlightSchedules_AircraftTypes
                    FOREIGN KEY (aircraft_type_id) REFERENCES AircraftTypes(aircraft_type_id),
                CONSTRAINT UQ_FlightSchedules_FlightNumber_Period
                    UNIQUE (flight_number, effective_from, effective_to)
            )
        `);

        await queryRunner.query(`
            CREATE TABLE FlightInstances (
                flight_instance_id UNIQUEIDENTIFIER NOT NULL
                    CONSTRAINT PK_FlightInstances PRIMARY KEY,
                flight_schedule_id UNIQUEIDENTIFIER NOT NULL,
                flight_date DATE NOT NULL,
                flight_number VARCHAR(10) NOT NULL,
                aircraft_id UNIQUEIDENTIFIER NULL,
                departure_datetime_local DATETIME2 NOT NULL,
                arrival_datetime_local DATETIME2 NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
                created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
                updated_at DATETIME2 NULL,
                CONSTRAINT FK_FlightInstances_FlightSchedules
                    FOREIGN KEY (flight_schedule_id) REFERENCES FlightSchedules(flight_schedule_id),
                CONSTRAINT FK_FlightInstances_Aircrafts
                    FOREIGN KEY (aircraft_id) REFERENCES Aircrafts(aircraft_id),
                CONSTRAINT UQ_FlightInstances_FlightNumber_Date
                    UNIQUE (flight_number, flight_date)
            )
        `);

        await queryRunner.query(`
            CREATE TABLE FlightSeats (
                flight_seat_id UNIQUEIDENTIFIER NOT NULL
                    CONSTRAINT PK_FlightSeats PRIMARY KEY,
                flight_instance_id UNIQUEIDENTIFIER NOT NULL,
                seat_config_id UNIQUEIDENTIFIER NOT NULL,
                seat_number VARCHAR(10) NOT NULL,
                is_available BIT NOT NULL DEFAULT 1,
                CONSTRAINT FK_FlightSeats_FlightInstances
                    FOREIGN KEY (flight_instance_id) REFERENCES FlightInstances(flight_instance_id),
                CONSTRAINT FK_FlightSeats_SeatConfigurations
                    FOREIGN KEY (seat_config_id) REFERENCES SeatConfigurations(seat_config_id),
                CONSTRAINT UQ_FlightSeats_Instance_SeatNumber
                    UNIQUE (flight_instance_id, seat_number)
            )
        `);

        // 4. CURRENCY / PAYMENTS
        await queryRunner.query(`
            CREATE TABLE Currencies (
                currency_code CHAR(3) NOT NULL
                    CONSTRAINT PK_Currencies PRIMARY KEY,
                name NVARCHAR(50) NOT NULL
            )
        `);

        await queryRunner.query(`
            CREATE TABLE PaymentMethods (
                payment_method_code VARCHAR(20) NOT NULL
                    CONSTRAINT PK_PaymentMethods PRIMARY KEY,
                name NVARCHAR(50) NOT NULL
            )
        `);

        // 5. BOOKINGS / SEGMENTS / TICKETS / PAYMENTS
        await queryRunner.query(`
            CREATE TABLE Bookings (
                booking_id UNIQUEIDENTIFIER NOT NULL 
                    CONSTRAINT PK_Bookings PRIMARY KEY,
                pnr_code VARCHAR(10) NOT NULL UNIQUE,
                user_id UNIQUEIDENTIFIER NULL,
                currency_code CHAR(3) NOT NULL,
                total_amount DECIMAL(12,2) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                channel VARCHAR(50) NULL,
                contact_fullname NVARCHAR(100) NOT NULL,
                contact_email VARCHAR(100) NOT NULL,
                contact_phone VARCHAR(20) NOT NULL,
                created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
                updated_at DATETIME2 NULL,
                CONSTRAINT FK_Bookings_Users
                    FOREIGN KEY (user_id) REFERENCES Users(user_id),
                CONSTRAINT FK_Bookings_Currencies
                    FOREIGN KEY (currency_code) REFERENCES Currencies(currency_code)
            )
        `);

        await queryRunner.query(`
            CREATE TABLE BookingPassengers (
                booking_passenger_id UNIQUEIDENTIFIER NOT NULL
                    CONSTRAINT PK_BookingPassengers PRIMARY KEY,
                booking_id UNIQUEIDENTIFIER NOT NULL,
                passenger_id UNIQUEIDENTIFIER NOT NULL,
                passenger_type VARCHAR(10) NOT NULL,
                CONSTRAINT FK_BookingPassengers_Bookings
                    FOREIGN KEY (booking_id) REFERENCES Bookings(booking_id)
                    ON DELETE CASCADE,
                CONSTRAINT FK_BookingPassengers_Passengers
                    FOREIGN KEY (passenger_id) REFERENCES Passengers(passenger_id),
                CONSTRAINT UQ_BookingPassengers_Booking_Passenger
                    UNIQUE (booking_id, passenger_id)
            )
        `);

        await queryRunner.query(`
            CREATE TABLE BookingSegments (
                booking_segment_id UNIQUEIDENTIFIER NOT NULL
                    CONSTRAINT PK_BookingSegments PRIMARY KEY,
                booking_id UNIQUEIDENTIFIER NOT NULL,
                booking_passenger_id UNIQUEIDENTIFIER NOT NULL,
                flight_instance_id UNIQUEIDENTIFIER NOT NULL,
                flight_seat_id UNIQUEIDENTIFIER NULL,
                fare_class_code VARCHAR(5) NOT NULL,
                base_fare DECIMAL(12,2) NOT NULL,
                tax_amount DECIMAL(12,2) NOT NULL,
                fee_amount DECIMAL(12,2) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'booked',
                CONSTRAINT FK_BookingSegments_Bookings
                    FOREIGN KEY (booking_id) REFERENCES Bookings(booking_id)
                    ON DELETE CASCADE,
                CONSTRAINT FK_BookingSegments_BookingPassengers
                    FOREIGN KEY (booking_passenger_id) REFERENCES BookingPassengers(booking_passenger_id),
                CONSTRAINT FK_BookingSegments_FlightInstances
                    FOREIGN KEY (flight_instance_id) REFERENCES FlightInstances(flight_instance_id),
                CONSTRAINT FK_BookingSegments_FlightSeats
                    FOREIGN KEY (flight_seat_id) REFERENCES FlightSeats(flight_seat_id),
                CONSTRAINT FK_BookingSegments_FareClasses
                    FOREIGN KEY (fare_class_code) REFERENCES FareClasses(fare_class_code)
            )
        `);

        await queryRunner.query(`
            CREATE TABLE Tickets (
                ticket_id UNIQUEIDENTIFIER NOT NULL 
                    CONSTRAINT PK_Tickets PRIMARY KEY,
                booking_id UNIQUEIDENTIFIER NOT NULL,
                booking_passenger_id UNIQUEIDENTIFIER NOT NULL,
                ticket_number VARCHAR(20) NOT NULL UNIQUE,
                issued_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
                status VARCHAR(20) NOT NULL DEFAULT 'active',
                CONSTRAINT FK_Tickets_Bookings
                    FOREIGN KEY (booking_id) REFERENCES Bookings(booking_id)
                    ON DELETE CASCADE,
                CONSTRAINT FK_Tickets_BookingPassengers
                    FOREIGN KEY (booking_passenger_id) REFERENCES BookingPassengers(booking_passenger_id)
            )
        `);

        await queryRunner.query(`
            CREATE TABLE Payments (
                payment_id UNIQUEIDENTIFIER NOT NULL 
                    CONSTRAINT PK_Payments PRIMARY KEY,
                booking_id UNIQUEIDENTIFIER NOT NULL,
                amount DECIMAL(12,2) NOT NULL,
                currency_code CHAR(3) NOT NULL,
                payment_method_code VARCHAR(20) NOT NULL,
                status VARCHAR(20) NOT NULL,
                paid_at DATETIME2 NULL,
                transaction_ref VARCHAR(100) NULL,
                created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
                CONSTRAINT FK_Payments_Bookings
                    FOREIGN KEY (booking_id) REFERENCES Bookings(booking_id),
                CONSTRAINT FK_Payments_Currencies
                    FOREIGN KEY (currency_code) REFERENCES Currencies(currency_code),
                CONSTRAINT FK_Payments_PaymentMethods
                    FOREIGN KEY (payment_method_code) REFERENCES PaymentMethods(payment_method_code)
            )
        `);

        // INDEXES
        await queryRunner.query(`
            CREATE INDEX IX_FlightInstances_FlightNumber_Date
                ON FlightInstances(flight_number, flight_date)
        `);

        await queryRunner.query(`
            CREATE INDEX IX_Bookings_UserId
                ON Bookings(user_id)
        `);

        await queryRunner.query(`
            CREATE INDEX IX_Bookings_PNR
                ON Bookings(pnr_code)
        `);

        await queryRunner.query(`
            CREATE INDEX IX_BookingSegments_FlightInstance
                ON BookingSegments(flight_instance_id)
        `);

        await queryRunner.query(`
            CREATE INDEX IX_Payments_BookingId
                ON Payments(booking_id)
        `);

        // TRIGGERS updated_at
        await queryRunner.query(`
            CREATE TRIGGER trg_Users_UpdateTimestamp
            ON Users
            AFTER UPDATE
            AS
            BEGIN
                SET NOCOUNT ON;
                UPDATE u
                SET u.updated_at = SYSDATETIME()
                FROM Users u
                INNER JOIN inserted i
                    ON u.user_id = i.user_id;
            END
        `);

        await queryRunner.query(`
            CREATE TRIGGER trg_FlightInstances_UpdateTimestamp
            ON FlightInstances
            AFTER UPDATE
            AS
            BEGIN
                SET NOCOUNT ON;
                UPDATE f
                SET f.updated_at = SYSDATETIME()
                FROM FlightInstances f
                INNER JOIN inserted i
                    ON f.flight_instance_id = i.flight_instance_id;
            END
        `);

        await queryRunner.query(`
            CREATE TRIGGER trg_Bookings_UpdateTimestamp
            ON Bookings
            AFTER UPDATE
            AS
            BEGIN
                SET NOCOUNT ON;
                UPDATE b
                SET b.updated_at = SYSDATETIME()
                FROM Bookings b
                INNER JOIN inserted i
                    ON b.booking_id = i.booking_id;
            END
        `);

        // TRIGGER Seat Availability
        await queryRunner.query(`
            CREATE TRIGGER trg_BookingSegments_SeatAvailability_IUD
            ON BookingSegments
            AFTER INSERT, UPDATE, DELETE
            AS
            BEGIN
                SET NOCOUNT ON;
                UPDATE s
                SET s.is_available = 0
                FROM FlightSeats s
                INNER JOIN inserted i
                    ON s.flight_seat_id = i.flight_seat_id
                WHERE i.flight_seat_id IS NOT NULL;
                UPDATE s
                SET s.is_available = 1
                FROM FlightSeats s
                INNER JOIN deleted d
                    ON s.flight_seat_id = d.flight_seat_id
                WHERE d.flight_seat_id IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM BookingSegments bs
                      WHERE bs.flight_seat_id = d.flight_seat_id
                  );
            END
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop triggers first
        await queryRunner.query(`DROP TRIGGER IF EXISTS trg_BookingSegments_SeatAvailability_IUD`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS trg_Bookings_UpdateTimestamp`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS trg_FlightInstances_UpdateTimestamp`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS trg_Users_UpdateTimestamp`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS trg_Routes_AutoGenerateImageLink`);

        // Drop tables in reverse order (respecting foreign keys)
        await queryRunner.query(`DROP TABLE IF EXISTS Payments`);
        await queryRunner.query(`DROP TABLE IF EXISTS Tickets`);
        await queryRunner.query(`DROP TABLE IF EXISTS BookingSegments`);
        await queryRunner.query(`DROP TABLE IF EXISTS BookingPassengers`);
        await queryRunner.query(`DROP TABLE IF EXISTS Bookings`);
        await queryRunner.query(`DROP TABLE IF EXISTS PaymentMethods`);
        await queryRunner.query(`DROP TABLE IF EXISTS Currencies`);
        await queryRunner.query(`DROP TABLE IF EXISTS FlightSeats`);
        await queryRunner.query(`DROP TABLE IF EXISTS FlightInstances`);
        await queryRunner.query(`DROP TABLE IF EXISTS FlightSchedules`);
        await queryRunner.query(`DROP TABLE IF EXISTS SeatConfigurations`);
        await queryRunner.query(`DROP TABLE IF EXISTS FareClasses`);
        await queryRunner.query(`DROP TABLE IF EXISTS CabinClasses`);
        await queryRunner.query(`DROP TABLE IF EXISTS Aircrafts`);
        await queryRunner.query(`DROP TABLE IF EXISTS AircraftTypes`);
        await queryRunner.query(`DROP TABLE IF EXISTS Routes`);
        await queryRunner.query(`DROP TABLE IF EXISTS Airports`);
        await queryRunner.query(`DROP TABLE IF EXISTS Passengers`);
        await queryRunner.query(`DROP TABLE IF EXISTS Users`);
    }
}

