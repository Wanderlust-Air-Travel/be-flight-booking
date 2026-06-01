-- Flight Booking — Seed Reference Data
-- Location: be-flight-booking/scripts/db-migrate/002_seed_data.sql
-- Run after 001_initial_schema.sql
-- =============================================================================

BEGIN;

-- ─── Airlines ────────────────────────────────────────────────────────────────

INSERT INTO airlines (iata_code, name, country, country_code, logo_url, active) VALUES
('VN', 'Vietnam Airlines',   'Vietnam', 'VN', 'https://static.vietnamairlines.com/vn.png', TRUE),
('VJ', 'Vietjet Air',      'Vietnam', 'VN', 'https://www.vietjetair.com/static/vi.png', TRUE),
('QH', 'Bamboo Airways',    'Vietnam', 'VN', 'https://www.bambooairways.com/logo.png',  TRUE),
('VU', 'Vietravel Airlines','Vietnam', 'VN', NULL,                                            TRUE)
ON CONFLICT (iata_code) DO NOTHING;

-- ─── Airports ─────────────────────────────────────────────────────────────

INSERT INTO airports (iata_code, name, city, country, country_code, latitude, longitude, timezone, altitude) VALUES
('HAN', 'Noi Bai International Airport',    'Hanoi',        'Vietnam', 'VN', 21.2212,  105.8069, 'Asia/Ho_Chi_Minh',  12),
('SGN', 'Tan Son Nhat International Airport','Ho Chi Minh City','Vietnam','VN', 10.8188, 106.6520, 'Asia/Ho_Chi_Minh',  10),
('DAD', 'Da Nang International Airport',     'Da Nang',      'Vietnam', 'VN', 16.0439,  108.1994, 'Asia/Ho_Chi_Minh',   7),
('CXR', 'Cam Ranh International Airport',   'Cam Ranh',     'Vietnam', 'VN', 11.9984,  109.2194, 'Asia/Ho_Chi_Minh',   6),
('HPH', 'Cat Bi International Airport',      'Hai Phong',    'Vietnam', 'VN', 20.8193,  106.7247, 'Asia/Ho_Chi_Minh',   4),
('PQC', 'Phu Quoc International Airport',   'Phu Quoc',     'Vietnam', 'VN', 10.1696,  103.9931, 'Asia/Ho_Chi_Minh',   5),
('VII', 'Vinh Airport',                     'Vinh',         'Vietnam', 'VN', 18.7379,  105.6704, 'Asia/Ho_Chi_Minh',   6),
('DLI', 'Lien Khuong Airport',              'Da Lat',        'Vietnam', 'VN', 11.7500,  108.1527, 'Asia/Ho_Chi_Minh',1500),
('HUI', 'Phu Bai Airport',                 'Hue',           'Vietnam', 'VN', 16.4015,  107.7026, 'Asia/Ho_Chi_Minh',   5),
('THD', 'Tho Xuan Airport',               'Thanh Hoa',     'Vietnam', 'VN', 19.9011,  105.4706, 'Asia/Ho_Chi_Minh',   8),
('VDH', 'Dong Hoi Airport',               'Dong Hoi',      'Vietnam', 'VN', 17.5107,  106.5901, 'Asia/Ho_Chi_Minh',  14),
('TBB', 'Tuy Hoa Airport',               'Tuy Hoa',       'Vietnam', 'VN', 13.0496,  109.3348, 'Asia/Ho_Chi_Minh',   5)
ON CONFLICT (iata_code) DO NOTHING;

-- ─── Routes ───────────────────────────────────────────────────────────────

INSERT INTO routes (origin_code, destination_code, airline_code, distance_km, avg_duration_minutes) VALUES
-- Hanoi routes
('HAN','SGN','VN',1160, 120), ('HAN','SGN','VJ',1160, 120), ('HAN','SGN','QH',1160, 120),
('HAN','DAD','VN', 570,  70), ('HAN','DAD','VJ', 570,  70), ('HAN','DAD','QH', 570,  70),
('HAN','CXR','VN',1060, 115), ('HAN','CXR','VJ',1060, 115), ('HAN','CXR','QH',1060, 115),
('HAN','HPH','VN',  85,  25), ('HAN','HPH','VJ',  85,  25),
('HAN','PQC','VN',1280, 135), ('HAN','PQC','VJ',1280, 135), ('HAN','PQC','QH',1280, 135),
('HAN','VII','VN', 310,  55), ('HAN','VII','VJ', 310,  55),
('HAN','DLI','VN',1000, 110), ('HAN','DLI','QH',1000, 110),
('HAN','HUI','VN', 620,  75), ('HAN','HUI','VJ', 620,  75),
-- Ho Chi Minh City routes
('SGN','DAD','VN', 960, 100), ('SGN','DAD','VJ', 960, 100), ('SGN','DAD','QH', 960, 100),
('SGN','CXR','VN', 310,  55), ('SGN','CXR','VJ', 310,  55), ('SGN','CXR','QH', 310,  55),
('SGN','PQC','VN', 290,  50), ('SGN','PQC','VJ', 290,  50), ('SGN','PQC','QH', 290,  50),
('SGN','DLI','VN',1100, 120), ('SGN','DLI','QH',1100, 120),
-- Da Nang routes
('DAD','SGN','VN', 960, 100), ('DAD','SGN','VJ', 960, 100), ('DAD','SGN','QH', 960, 100),
('DAD','HPH','VN', 520,  65), ('DAD','HPH','VJ', 520,  65),
('DAD','CXR','VN', 500,  60), ('DAD','CXR','VJ', 500,  60),
('DAD','HUI','VN',  90,  25), ('DAD','HUI','VJ',  90,  25),
('DAD','VDH','VN', 240,  40), ('DAD','VDH','VJ', 240,  40),
('DAD','TBB','VN', 380,  50)
ON CONFLICT (origin_code, destination_code, airline_code) DO NOTHING;

-- ─── Fare Rules (distance-based base fares in VND) ───────────────────────

INSERT INTO fare_rules
  (airline_code, origin_code, destination_code, cabin_class, fare_class,
   base_fare_vnd, fuel_surcharge_vnd, airport_tax_vnd, service_fee_vnd,
   baggage_allowance_kg, carry_on_kg, refundable, valid_from, valid_until)
SELECT
  r.airline_code, r.origin_code, r.destination_code,
  cc.class, fc.class,
  ROUND(r.distance_km * cc.rate + 400000, -3) AS base_fare_vnd,
  330000, 400000, 200000,
  CASE cc.class WHEN 'economy' THEN 20 WHEN 'premium_economy' THEN 25 WHEN 'business' THEN 30 ELSE 40 END,
  7, FALSE,
  CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year'
FROM
  (SELECT DISTINCT origin_code, destination_code, airline_code, distance_km FROM routes) r,
  (VALUES
    ('economy',        'economy',        'economy',        8.5),
    ('premium_economy','premium_economy','premium_economy',12.0),
    ('business',       'business',       'business',       22.0)) AS cc(class, cabin_class, fare_class, rate),
  (VALUES ('economy', 'V'), ('economy', 'W'), ('economy', 'Y'),
           ('premium_economy', 'B'), ('premium_economy', 'H'),
           ('business', 'C'), ('business', 'D')) AS fc(class, fare_class)
WHERE cc.class = fc.class
ON CONFLICT DO NOTHING;

-- ─── Admin User (password: admin123) ────────────────────────────────────
-- bcrypt hash of "admin123" with cost 12

INSERT INTO users (id, email, password_hash, first_name, last_name, phone, role, email_verified, is_active) VALUES
('00000000-0000-0000-0000-000000000001',
 'admin@flightbooking.com',
 '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.xQJvTnOLtQqW0e',
 'System', 'Administrator', '+84912345678', 'admin', TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

COMMIT;
