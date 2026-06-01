-- Flight Booking — Initial Schema Migration
-- PostgreSQL 16
-- Location: be-flight-booking/scripts/db-migrate/001_initial_schema.sql
-- Run: docker compose exec postgres psql -U flightbooking -d flightbooking -f /migrations/001_initial_schema.sql
-- =============================================================================

BEGIN;

-- ─── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enums ─────────────────────────────────────────────────────────────────

CREATE TYPE flight_status AS ENUM (
    'scheduled', 'boarding', 'departed', 'in_air',
    'landed', 'arrived', 'cancelled', 'delayed'
);

CREATE TYPE booking_status AS ENUM (
    'pending', 'confirmed', 'payment_pending', 'payment_failed',
    'ticketed', 'cancelled', 'refunded', 'voided'
);

CREATE TYPE payment_status AS ENUM (
    'pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'
);

CREATE TYPE payment_provider AS ENUM ('mock', 'stripe', 'vnpay', 'paypal');

CREATE TYPE cabin_class AS ENUM ('economy', 'premium_economy', 'business', 'first');

CREATE TYPE fare_class AS ENUM ('V', 'W', 'Y', 'B', 'H', 'K', 'M', 'Q', 'N', 'O');

CREATE TYPE gender AS ENUM ('male', 'female', 'other');

CREATE TYPE passenger_type AS ENUM ('adult', 'child', 'infant');

CREATE TYPE currency AS ENUM ('VND', 'USD');

-- ─── Core Tables ─────────────────────────────────────────────────────────────

CREATE TABLE airports (
    iata_code      CHAR(3) PRIMARY KEY,
    name           VARCHAR(255) NOT NULL,
    city           VARCHAR(100) NOT NULL,
    country        VARCHAR(100) NOT NULL DEFAULT 'Vietnam',
    country_code   CHAR(2) NOT NULL DEFAULT 'VN',
    latitude       DECIMAL(10, 7),
    longitude      DECIMAL(10, 7),
    timezone       VARCHAR(50) DEFAULT 'Asia/Ho_Chi_Minh',
    altitude       INTEGER,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE airlines (
    iata_code      CHAR(2) PRIMARY KEY,
    name           VARCHAR(255) NOT NULL,
    country        VARCHAR(100) NOT NULL,
    country_code   CHAR(2) NOT NULL,
    logo_url       VARCHAR(500),
    active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE routes (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origin_code    CHAR(3) NOT NULL REFERENCES airports(iata_code),
    destination_code CHAR(3) NOT NULL REFERENCES airports(iata_code),
    airline_code   CHAR(2) NOT NULL REFERENCES airlines(iata_code),
    distance_km    INTEGER NOT NULL,
    avg_duration_minutes INTEGER NOT NULL,
    active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(origin_code, destination_code, airline_code)
);

CREATE TABLE flight_external_sources (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id    VARCHAR(255) NOT NULL,
    provider       VARCHAR(50) NOT NULL,
    flight_number  VARCHAR(20),
    airline_code   CHAR(2),
    dep_iata       CHAR(3),
    arr_iata       CHAR(3),
    dep_time_utc  TIMESTAMPTZ,
    arr_time_utc  TIMESTAMPTZ,
    status         VARCHAR(30),
    raw_data       JSONB,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(external_id, provider)
);

CREATE TABLE flight_schedules (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flight_number  VARCHAR(20) NOT NULL,
    airline_code   CHAR(2) NOT NULL REFERENCES airlines(iata_code),
    origin_code    CHAR(3) NOT NULL REFERENCES airports(iata_code),
    destination_code CHAR(3) NOT NULL REFERENCES airports(iata_code),
    departure_time TIME NOT NULL,
    arrival_time   TIME NOT NULL,
    duration_minutes INTEGER NOT NULL,
    aircraft_type  VARCHAR(20),
    operating_days INTEGER NOT NULL DEFAULT 127,
    active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE fare_rules (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    airline_code   CHAR(2) NOT NULL REFERENCES airlines(iata_code),
    origin_code    CHAR(3) REFERENCES airports(iata_code),
    destination_code CHAR(3) REFERENCES airports(iata_code),
    cabin_class    cabin_class NOT NULL,
    fare_class     fare_class NOT NULL,
    base_fare_vnd  INTEGER NOT NULL,
    fuel_surcharge_vnd INTEGER NOT NULL DEFAULT 330000,
    airport_tax_vnd INTEGER NOT NULL DEFAULT 400000,
    service_fee_vnd INTEGER NOT NULL DEFAULT 200000,
    baggage_allowance_kg INTEGER NOT NULL DEFAULT 20,
    carry_on_kg    INTEGER NOT NULL DEFAULT 7,
    change_fee_vnd  INTEGER NOT NULL DEFAULT 0,
    refund_fee_vnd  INTEGER NOT NULL DEFAULT 0,
    refundable     BOOLEAN NOT NULL DEFAULT FALSE,
    valid_from     DATE NOT NULL,
    valid_until    DATE NOT NULL,
    active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE flight_instances (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id    UUID REFERENCES flight_schedules(id),
    external_source_id UUID REFERENCES flight_external_sources(id),
    flight_number  VARCHAR(20) NOT NULL,
    airline_code   CHAR(2) NOT NULL REFERENCES airlines(iata_code),
    origin_code    CHAR(3) NOT NULL REFERENCES airports(iata_code),
    destination_code CHAR(3) NOT NULL REFERENCES airports(iata_code),
    departure_time TIMESTAMPTZ NOT NULL,
    arrival_time   TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL,
    aircraft_type  VARCHAR(20),
    status         flight_status NOT NULL DEFAULT 'scheduled',
    total_seats    INTEGER NOT NULL DEFAULT 180,
    available_seats INTEGER NOT NULL DEFAULT 180,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE flight_seats (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flight_instance_id UUID NOT NULL REFERENCES flight_instances(id) ON DELETE CASCADE,
    seat_number    VARCHAR(4) NOT NULL,
    seat_row       INTEGER NOT NULL,
    seat_column    VARCHAR(2) NOT NULL,
    cabin_class    cabin_class NOT NULL,
    fare_class     fare_class NOT NULL,
    fare_vnd       INTEGER NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'available',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(flight_instance_id, seat_number)
);

-- ─── Booking Tables ─────────────────────────────────────────────────────────

CREATE TABLE passengers (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title          VARCHAR(10) NOT NULL,
    first_name     VARCHAR(100) NOT NULL,
    last_name      VARCHAR(100) NOT NULL,
    gender         gender NOT NULL,
    date_of_birth  DATE NOT NULL,
    nationality    CHAR(2) NOT NULL DEFAULT 'VN',
    passport_number VARCHAR(20),
    passport_expiry DATE,
    email          VARCHAR(255) NOT NULL,
    phone          VARCHAR(20),
    type           passenger_type NOT NULL DEFAULT 'adult',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bookings (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_code   VARCHAR(8) NOT NULL UNIQUE,
    user_id        UUID,
    status         booking_status NOT NULL DEFAULT 'pending',
    trip_type      VARCHAR(20) NOT NULL DEFAULT 'one_way',
    total_amount_vnd BIGINT NOT NULL,
    base_fare_vnd  BIGINT NOT NULL,
    taxes_vnd      BIGINT NOT NULL,
    fees_vnd       BIGINT NOT NULL,
    currency       currency NOT NULL DEFAULT 'VND',
    passenger_count INTEGER NOT NULL,
    contact_email  VARCHAR(255) NOT NULL,
    contact_phone  VARCHAR(20),
    contact_name   VARCHAR(200),
    booking_source VARCHAR(50) NOT NULL DEFAULT 'web',
    agent_id       UUID,
    payment_deadline TIMESTAMPTZ,
    ticketed_at    TIMESTAMPTZ,
    voided_at      TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE booking_passengers (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id     UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    passenger_id   UUID NOT NULL REFERENCES passengers(id),
    cabin_class    cabin_class NOT NULL,
    fare_class     fare_class NOT NULL,
    seat_id        UUID REFERENCES flight_seats(id),
    seat_number    VARCHAR(4),
    ticket_number  VARCHAR(20),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(booking_id, passenger_id)
);

CREATE TABLE booking_flights (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id     UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    flight_instance_id UUID NOT NULL REFERENCES flight_instances(id),
    leg_order      INTEGER NOT NULL DEFAULT 1,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id     UUID NOT NULL REFERENCES bookings(id),
    amount_vnd     BIGINT NOT NULL,
    currency       currency NOT NULL DEFAULT 'VND',
    provider       payment_provider NOT NULL DEFAULT 'mock',
    provider_txn_id VARCHAR(255),
    status         payment_status NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(50),
    payment_url    VARCHAR(500),
    payer_email    VARCHAR(255),
    completed_at   TIMESTAMPTZ,
    failure_reason TEXT,
    metadata       JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Auth Tables ────────────────────────────────────────────────────────────

CREATE TABLE users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email          VARCHAR(255) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    first_name     VARCHAR(100),
    last_name      VARCHAR(100),
    phone          VARCHAR(20),
    role           VARCHAR(20) NOT NULL DEFAULT 'customer',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at  TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_sessions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash     VARCHAR(255) NOT NULL,
    refresh_token_hash VARCHAR(255),
    user_agent     VARCHAR(500),
    ip_address     VARCHAR(45),
    expires_at     TIMESTAMPTZ NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Notifications & Audit ─────────────────────────────────────────────────

CREATE TABLE notifications (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID REFERENCES users(id),
    booking_id     UUID REFERENCES bookings(id),
    type           VARCHAR(50) NOT NULL,
    channel        VARCHAR(20) NOT NULL DEFAULT 'email',
    recipient      VARCHAR(255) NOT NULL,
    subject        VARCHAR(255),
    content        TEXT NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'pending',
    sent_at        TIMESTAMPTZ,
    failure_reason TEXT,
    metadata       JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_log (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type    VARCHAR(100) NOT NULL,
    entity_id      UUID NOT NULL,
    action         VARCHAR(50) NOT NULL,
    actor_id       UUID,
    actor_email    VARCHAR(255),
    changes        JSONB,
    ip_address     VARCHAR(45),
    user_agent     VARCHAR(500),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX idx_flight_instances_departure ON flight_instances(departure_time);
CREATE INDEX idx_flight_instances_route ON flight_instances(origin_code, destination_code);
CREATE INDEX idx_flight_instances_status ON flight_instances(status);
CREATE INDEX idx_flight_instances_schedule ON flight_instances(schedule_id);
CREATE INDEX idx_flight_instances_external ON flight_instances(external_source_id);
CREATE INDEX idx_flight_schedules_route ON flight_schedules(origin_code, destination_code);
CREATE INDEX idx_flight_schedules_airline ON flight_schedules(airline_code);
CREATE INDEX idx_bookings_code ON bookings(booking_code);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_created ON bookings(created_at);
CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_txn ON payments(provider_txn_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_routes_od ON routes(origin_code, destination_code);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);

-- ─── Triggers ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_airports_updated_at       BEFORE UPDATE ON airports              FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_airlines_updated_at       BEFORE UPDATE ON airlines              FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_routes_updated_at         BEFORE UPDATE ON routes                FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_flight_schedules_updated  BEFORE UPDATE ON flight_schedules       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_fare_rules_updated_at     BEFORE UPDATE ON fare_rules             FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_flight_instances_updated  BEFORE UPDATE ON flight_instances       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_flight_seats_updated_at   BEFORE UPDATE ON flight_seats          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_passengers_updated_at     BEFORE UPDATE ON passengers            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_bookings_updated_at       BEFORE UPDATE ON bookings              FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_payments_updated_at       BEFORE UPDATE ON payments              FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated_at          BEFORE UPDATE ON users                 FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;
