/* =========================================================
   TẠO DATABASE MỚI
   ========================================================= */
CREATE DATABASE flight_booking_db;
GO

USE flight_booking_db;
GO

/* =========================================================
   0. USERS / PASSENGERS
   ========================================================= */
CREATE TABLE Users (
    user_id UNIQUEIDENTIFIER NOT NULL 
        CONSTRAINT PK_Users PRIMARY KEY,
        -- Note: Application code must generate UUID v7 for user_id
    fullname NVARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NULL,

    -- auth-related
    refresh_token                     VARCHAR(255) NULL,
    refresh_token_expires_at          DATETIME2 NULL,
    forgot_password_token             VARCHAR(255) NULL,
    forgot_password_token_expires_at  DATETIME2 NULL,
    is_active                         BIT NOT NULL DEFAULT 1
);
GO

CREATE TABLE Passengers (
    passenger_id UNIQUEIDENTIFIER NOT NULL 
        CONSTRAINT PK_Passengers PRIMARY KEY,
        -- Note: Application code must generate UUID v7 for passenger_id
    user_id UNIQUEIDENTIFIER NULL,          -- người sở hữu / tạo passenger
    fullname NVARCHAR(100) NOT NULL,
    dob DATE NOT NULL,
    gender NVARCHAR(10) NOT NULL,
    document_number VARCHAR(50) NULL,      -- CCCD / Passport (nullable for CHD and INF passengers)
    loyalty_number VARCHAR(50) NULL,        -- mã khách hàng thân thiết (nếu có)
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_Passengers_Users
        FOREIGN KEY (user_id) REFERENCES Users(user_id)
);
GO

/* =========================================================
   1. AIRPORTS & ROUTES
   ========================================================= */
CREATE TABLE Airports (
    airport_id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_Airports PRIMARY KEY,
        -- Note: Application code must generate UUID v7 for airport_id
    iata_code CHAR(3) NOT NULL UNIQUE,      -- SGN, HAN, DAD...
    icao_code CHAR(4) NULL,                 -- VVTS, VVNB...
    name NVARCHAR(150) NOT NULL,
    city NVARCHAR(100) NOT NULL,
    country NVARCHAR(100) NOT NULL,
    timezone VARCHAR(50) NOT NULL           -- VD: 'Asia/Ho_Chi_Minh'
);
GO

CREATE TABLE Routes (
    route_id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_Routes PRIMARY KEY,
        -- Note: Application code must generate UUID v7 for route_id
    origin_airport_id UNIQUEIDENTIFIER NOT NULL,
    destination_airport_id UNIQUEIDENTIFIER NOT NULL,
    distance_km INT NULL,
    is_domestic BIT NOT NULL DEFAULT 1,     -- nội địa / quốc tế
    image_url NVARCHAR(255) NULL,           -- Đường dẫn đến hình ảnh deal, format: '/images/routes/{route_id}.jpg' (length = 55, route_id là UUID v7 - 36 ký tự)
    service_link NVARCHAR(255) NULL,        -- Link đến trang service, format: '/service/{route_id}' (route_id là UUID v7 - 36 ký tự)
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    -- Validation constraints
    CONSTRAINT CK_Routes_ImageUrl_Format
        CHECK (
            image_url IS NULL 
            OR (
                image_url LIKE '/images/routes/%.jpg'
                AND LEN(image_url) = 55  -- '/images/routes/' (15) + UUID v7 (36) + '.jpg' (4) = 55
                AND SUBSTRING(image_url, 16, 36) = CAST(route_id AS VARCHAR(36))
            )
        ),
    CONSTRAINT CK_Routes_ServiceLink_Format
        CHECK (
            service_link IS NULL 
            OR (
                service_link LIKE '/service/%'
                AND LEN(service_link) = 45  -- '/service/' (9) + UUID v7 (36) = 45
                AND SUBSTRING(service_link, 10, 36) = CAST(route_id AS VARCHAR(36))
                -- Format: '/service/{route_id}' - route_id phải là UUID v7 của chính route này
            )
        ),

    CONSTRAINT FK_Routes_OriginAirport
        FOREIGN KEY (origin_airport_id) REFERENCES Airports(airport_id),

    CONSTRAINT FK_Routes_DestinationAirport
        FOREIGN KEY (destination_airport_id) REFERENCES Airports(airport_id),

    CONSTRAINT UQ_Routes_Origin_Destination
        UNIQUE (origin_airport_id, destination_airport_id)
);
GO

-- Giá vé theo route và fare class
CREATE TABLE RouteFarePrices (
    route_fare_price_id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_RouteFarePrices PRIMARY KEY,
        -- Note: Application code must generate UUID v7 for route_fare_price_id
    route_id UNIQUEIDENTIFIER NOT NULL,
    fare_class_code VARCHAR(5) NOT NULL,
    base_price DECIMAL(12,2) NOT NULL,         -- Giá cơ bản (VND)
    tax_rate DECIMAL(5,4) NOT NULL DEFAULT 0.1, -- Thuế suất (10% = 0.1)
    fee_rate DECIMAL(5,4) NOT NULL DEFAULT 0.05, -- Phí suất (5% = 0.05)
    effective_from DATE NOT NULL,              -- Ngày bắt đầu áp dụng
    effective_to DATE NULL,                    -- Ngày kết thúc (NULL = vô thời hạn)
    is_active BIT NOT NULL DEFAULT 1,
    priority INT NOT NULL DEFAULT 0,           -- Độ ưu tiên (cao hơn = ưu tiên hơn)
    notes NVARCHAR(500) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NULL,

    CONSTRAINT FK_RouteFarePrices_Routes
        FOREIGN KEY (route_id) REFERENCES Routes(route_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT FK_RouteFarePrices_FareClasses
        FOREIGN KEY (fare_class_code) REFERENCES FareClasses(fare_class_code)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);
GO

-- Trigger: Tự động generate image_url và service_link theo format chuẩn
-- Format chuẩn (theo thực tế các doanh nghiệp):
-- image_url: '/images/routes/{route_id}.jpg' (dùng route_id để xác định route)
-- service_link: '/service/{route_id}' (route_id là UUID v7 - 36 ký tự)
CREATE TRIGGER trg_Routes_AutoGenerateImageLink
ON Routes
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Chỉ update các records có image_url hoặc service_link NULL hoặc không đúng format
    UPDATE r
    SET 
        -- Generate image_url nếu NULL hoặc không đúng format
        image_url = CASE 
            WHEN r.image_url IS NULL 
                OR r.image_url NOT LIKE '/images/routes/%.jpg'
                OR LEN(r.image_url) != 55
                OR SUBSTRING(r.image_url, 16, 36) != CAST(r.route_id AS VARCHAR(36))
            THEN '/images/routes/' + CAST(r.route_id AS VARCHAR(36)) + '.jpg'
            ELSE r.image_url
        END,
        -- Generate service_link nếu NULL hoặc không đúng format
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
GO

/* =========================================================
   2. AIRCRAFT TYPES / AIRCRAFTS / SEAT CONFIGURATIONS
   ========================================================= */
CREATE TABLE AircraftTypes (
    aircraft_type_id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_AircraftTypes PRIMARY KEY,
        -- Note: Application code must generate UUID v7 for aircraft_type_id
    code VARCHAR(20) NOT NULL UNIQUE,       -- A321, B787-9...
    manufacturer NVARCHAR(100) NOT NULL,    -- Airbus, Boeing...
    model NVARCHAR(100) NOT NULL,
    total_seats INT NOT NULL
);
GO

CREATE TABLE Aircrafts (
    aircraft_id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_Aircrafts PRIMARY KEY,
        -- Note: Application code must generate UUID v7 for aircraft_id
    aircraft_type_id UNIQUEIDENTIFIER NOT NULL,
    registration VARCHAR(20) NOT NULL UNIQUE,   -- số hiệu máy bay: VN-A321
    in_service BIT NOT NULL DEFAULT 1,

    CONSTRAINT FK_Aircrafts_AircraftTypes
        FOREIGN KEY (aircraft_type_id) REFERENCES AircraftTypes(aircraft_type_id)
);
GO

-- Cabin class chuẩn: Y (Economy), W (Premium), J (Business), F (First)
CREATE TABLE CabinClasses (
    cabin_class_code VARCHAR(5) NOT NULL
        CONSTRAINT PK_CabinClasses PRIMARY KEY,
    name NVARCHAR(50) NOT NULL              -- Economy, Business...
);
GO

-- Fare class (booking class): Y, M, B, K...
CREATE TABLE FareClasses (
    fare_class_code VARCHAR(5) NOT NULL
        CONSTRAINT PK_FareClasses PRIMARY KEY,
    cabin_class_code VARCHAR(5) NOT NULL,
    description NVARCHAR(200) NULL,
    change_rule NVARCHAR(500) NULL,         -- mô tả rule đổi vé
    refund_rule NVARCHAR(500) NULL,         -- mô tả rule hoàn vé

    CONSTRAINT FK_FareClasses_CabinClasses
        FOREIGN KEY (cabin_class_code) REFERENCES CabinClasses(cabin_class_code)
);
GO

-- Quy định hành lý theo fare class
CREATE TABLE BaggageAllowances (
    baggage_allowance_id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_BaggageAllowances PRIMARY KEY,
        -- Note: Application code must generate UUID v7 for baggage_allowance_id
    fare_class_code VARCHAR(5) NOT NULL,
    checked_baggage_kg INT NULL,              -- Hành lý ký gửi (kg)
    checked_baggage_pieces INT NULL,          -- Số lượng kiện hành lý ký gửi
    carry_on_kg INT NOT NULL DEFAULT 7,        -- Hành lý xách tay (kg)
    carry_on_pieces INT NOT NULL DEFAULT 1,   -- Số lượng kiện hành lý xách tay
    carry_on_dimensions NVARCHAR(50) NULL,    -- Kích thước hành lý xách tay
    is_domestic BIT NOT NULL DEFAULT 1,       -- Áp dụng cho chuyến bay nội địa
    is_international BIT NOT NULL DEFAULT 1,   -- Áp dụng cho chuyến bay quốc tế
    notes NVARCHAR(500) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NULL,

    CONSTRAINT FK_BaggageAllowances_FareClasses
        FOREIGN KEY (fare_class_code) REFERENCES FareClasses(fare_class_code)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);
GO

-- Dịch vụ cabin (meals, WiFi, entertainment, etc.)
CREATE TABLE CabinServices (
    cabin_service_id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_CabinServices PRIMARY KEY,
        -- Note: Application code must generate UUID v7 for cabin_service_id
    cabin_class_code VARCHAR(5) NULL,         -- NULL nếu service áp dụng cho fare class cụ thể
    fare_class_code VARCHAR(5) NULL,          -- NULL nếu service áp dụng cho cabin class
    service_type VARCHAR(50) NOT NULL,         -- meal, wifi, entertainment, etc.
    service_name NVARCHAR(200) NOT NULL,
    description NVARCHAR(1000) NULL,
    is_included BIT NOT NULL DEFAULT 1,        -- true = included, false = available for purchase
    price DECIMAL(12,2) NULL,                  -- Price if not included (VND)
    is_active BIT NOT NULL DEFAULT 1,
    display_order INT NOT NULL DEFAULT 0,
    icon_url NVARCHAR(500) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NULL,

    CONSTRAINT FK_CabinServices_CabinClasses
        FOREIGN KEY (cabin_class_code) REFERENCES CabinClasses(cabin_class_code)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT FK_CabinServices_FareClasses
        FOREIGN KEY (fare_class_code) REFERENCES FareClasses(fare_class_code)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);
GO

-- Quy tắc mô tả giá vé (fare description rules)
CREATE TABLE FareDescriptionRules (
    id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_FareDescriptionRules PRIMARY KEY DEFAULT NEWID(),
    fare_class_code_pattern VARCHAR(50) NOT NULL,  -- Pattern để match fare class (e.g., 'YS', 'Y%', 'J%')
    cabin_type VARCHAR(20) NOT NULL,               -- economy, business, first
    description_text NVARCHAR(500) NOT NULL,        -- Mô tả (e.g., 'Hành lý xách tay: 7kg')
    status BIT NOT NULL DEFAULT 1,                 -- included/excluded
    display_order INT NOT NULL DEFAULT 0,
    is_active BIT NOT NULL DEFAULT 1,
    is_default BIT NOT NULL DEFAULT 0,             -- Rule mặc định cho cabin type
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NULL
);
GO

-- Layout ghế chuẩn theo loại máy bay
CREATE TABLE SeatConfigurations (
    seat_config_id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_SeatConfigurations PRIMARY KEY,
        -- Note: Application code must generate UUID v7 for seat_config_id
    aircraft_type_id UNIQUEIDENTIFIER NOT NULL,
    seat_number VARCHAR(10) NOT NULL,       -- 1A, 10C...
    cabin_class_code VARCHAR(5) NOT NULL,   -- Economy/Business...
    seat_type VARCHAR(20) NULL,             -- Window / Aisle / Middle
    is_exit_row BIT NOT NULL DEFAULT 0,

    CONSTRAINT FK_SeatConfigurations_AircraftTypes
        FOREIGN KEY (aircraft_type_id) REFERENCES AircraftTypes(aircraft_type_id),

    CONSTRAINT FK_SeatConfigurations_CabinClasses
        FOREIGN KEY (cabin_class_code) REFERENCES CabinClasses(cabin_class_code),

    CONSTRAINT UQ_SeatConfigurations_AircraftType_SeatNumber
        UNIQUE (aircraft_type_id, seat_number)
);
GO

/* =========================================================
   3. FLIGHT SCHEDULES & INSTANCES
   ========================================================= */

-- Định nghĩa lịch bay: VN210 SGN-HAN, bay các ngày 1-3-5-7...
CREATE TABLE FlightSchedules (
    flight_schedule_id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_FlightSchedules PRIMARY KEY,
        -- Note: Application code must generate UUID v7 for flight_schedule_id
    flight_number VARCHAR(10) NOT NULL,      -- VN210, QH1522...
    route_id UNIQUEIDENTIFIER NOT NULL,
    aircraft_type_id UNIQUEIDENTIFIER NOT NULL,
    departure_time_local TIME NOT NULL,      -- giờ cất cánh local
    arrival_time_local TIME NOT NULL,        -- giờ hạ cánh local
    operating_days CHAR(7) NOT NULL,         -- ví dụ: 'YNNYNNY' (CN→T7)
    effective_from DATE NOT NULL,
    effective_to DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active/inactive

    CONSTRAINT FK_FlightSchedules_Routes
        FOREIGN KEY (route_id) REFERENCES Routes(route_id),

    CONSTRAINT FK_FlightSchedules_AircraftTypes
        FOREIGN KEY (aircraft_type_id) REFERENCES AircraftTypes(aircraft_type_id),

    CONSTRAINT UQ_FlightSchedules_FlightNumber_Period
        UNIQUE (flight_number, effective_from, effective_to)
);
GO

-- Chuyến bay thực tế theo ngày (instance)
CREATE TABLE FlightInstances (
    flight_instance_id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_FlightInstances PRIMARY KEY,
        -- Note: Application code must generate UUID v7 for flight_instance_id
    flight_schedule_id UNIQUEIDENTIFIER NOT NULL,
    flight_date DATE NOT NULL,                  -- ngày bay
    flight_number VARCHAR(10) NOT NULL,         -- copy từ schedule để dễ query
    aircraft_id UNIQUEIDENTIFIER NULL,          -- máy bay thực tế sử dụng
    departure_datetime_local DATETIME2 NOT NULL,
    arrival_datetime_local DATETIME2 NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled', -- scheduled, departed, landed, canceled...
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NULL,

    CONSTRAINT FK_FlightInstances_FlightSchedules
        FOREIGN KEY (flight_schedule_id) REFERENCES FlightSchedules(flight_schedule_id),

    CONSTRAINT FK_FlightInstances_Aircrafts
        FOREIGN KEY (aircraft_id) REFERENCES Aircrafts(aircraft_id),

    CONSTRAINT UQ_FlightInstances_FlightNumber_Date
        UNIQUE (flight_number, flight_date)
);
GO

-- Ghế theo từng FlightInstance (availability)
CREATE TABLE FlightSeats (
    flight_seat_id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_FlightSeats PRIMARY KEY,
        -- Note: Application code must generate UUID v7 for flight_seat_id
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
);
GO

/* =========================================================
   4. CURRENCY / PAYMENTS
   ========================================================= */
CREATE TABLE Currencies (
    currency_code CHAR(3) NOT NULL
        CONSTRAINT PK_Currencies PRIMARY KEY,   -- VND, USD, EUR...
    name NVARCHAR(50) NOT NULL
);
GO

CREATE TABLE PaymentMethods (
    payment_method_code VARCHAR(20) NOT NULL
        CONSTRAINT PK_PaymentMethods PRIMARY KEY,
    name NVARCHAR(50) NOT NULL,               -- Card, BankTransfer, Momo...
    is_active BIT NOT NULL DEFAULT 1          -- Payment method availability
);
GO

/* =========================================================
   5. BOOKINGS / SEGMENTS / TICKETS / PAYMENTS
   ========================================================= */

CREATE TABLE Bookings (
    booking_id UNIQUEIDENTIFIER NOT NULL 
        CONSTRAINT PK_Bookings PRIMARY KEY,
        -- Note: Application code must generate UUID v7 for booking_id
    pnr_code VARCHAR(10) NOT NULL UNIQUE,     -- mã đặt chỗ (PNR)
    user_id UNIQUEIDENTIFIER NULL,            -- khách đã login (nếu có)
    currency_code CHAR(3) NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending/paid/canceled
    channel VARCHAR(50) NULL,                 -- web/app/agent...
    contact_fullname NVARCHAR(100) NOT NULL,
    contact_email VARCHAR(100) NOT NULL,
    contact_phone VARCHAR(20) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NULL,

    CONSTRAINT FK_Bookings_Users
        FOREIGN KEY (user_id) REFERENCES Users(user_id),

    CONSTRAINT FK_Bookings_Currencies
        FOREIGN KEY (currency_code) REFERENCES Currencies(currency_code)
);
GO

-- Hành khách trong 1 booking
CREATE TABLE BookingPassengers (
    booking_passenger_id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_BookingPassengers PRIMARY KEY,
        -- Note: Application code must generate UUID v7 for booking_passenger_id
    booking_id UNIQUEIDENTIFIER NOT NULL,
    passenger_id UNIQUEIDENTIFIER NOT NULL,
    passenger_type VARCHAR(10) NOT NULL,      -- ADT/CHD/INF

    CONSTRAINT FK_BookingPassengers_Bookings
        FOREIGN KEY (booking_id) REFERENCES Bookings(booking_id)
        ON DELETE CASCADE,

    CONSTRAINT FK_BookingPassengers_Passengers
        FOREIGN KEY (passenger_id) REFERENCES Passengers(passenger_id),

    CONSTRAINT UQ_BookingPassengers_Booking_Passenger
        UNIQUE (booking_id, passenger_id)
);
GO

-- Mỗi passenger trên mỗi chặng (flight_instance) + ghế + giá
CREATE TABLE BookingSegments (
    booking_segment_id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_BookingSegments PRIMARY KEY,
        -- Note: Application code must generate UUID v7 for booking_segment_id
    booking_id UNIQUEIDENTIFIER NOT NULL,
    booking_passenger_id UNIQUEIDENTIFIER NOT NULL,
    flight_instance_id UNIQUEIDENTIFIER NOT NULL,
    flight_seat_id UNIQUEIDENTIFIER NULL,
    fare_class_code VARCHAR(5) NOT NULL,
    base_fare DECIMAL(12,2) NOT NULL,
    tax_amount DECIMAL(12,2) NOT NULL,
    fee_amount DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'booked',  -- booked/canceled/flown...

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
);
GO

-- Dịch vụ cabin đã chọn cho mỗi booking segment
CREATE TABLE BookingSegmentServices (
    booking_segment_service_id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_BookingSegmentServices PRIMARY KEY,
        -- Note: Application code must generate UUID v7 for booking_segment_service_id
    booking_segment_id UNIQUEIDENTIFIER NOT NULL,
    cabin_service_id UNIQUEIDENTIFIER NOT NULL,
    service_type VARCHAR(50) NOT NULL,        -- meal, wifi, entertainment, etc.
    service_name NVARCHAR(200) NOT NULL,      -- denormalized for quick access
    price DECIMAL(12,2) NULL,                 -- Price at time of booking (NULL if included)
    is_included BIT NOT NULL DEFAULT 0,        -- Whether service was included (1) or purchased (0)
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_BookingSegmentServices_BookingSegments
        FOREIGN KEY (booking_segment_id) REFERENCES BookingSegments(booking_segment_id)
        ON DELETE CASCADE,

    CONSTRAINT FK_BookingSegmentServices_CabinServices
        FOREIGN KEY (cabin_service_id) REFERENCES CabinServices(cabin_service_id)
);
GO

-- Vé điện tử (e-ticket) theo passenger
CREATE TABLE Tickets (
    ticket_id UNIQUEIDENTIFIER NOT NULL 
        CONSTRAINT PK_Tickets PRIMARY KEY,
        -- Note: Application code must generate UUID v7 for ticket_id
    booking_id UNIQUEIDENTIFIER NOT NULL,
    booking_passenger_id UNIQUEIDENTIFIER NOT NULL,
    ticket_number VARCHAR(20) NOT NULL UNIQUE,
    issued_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    status VARCHAR(20) NOT NULL DEFAULT 'active',   -- active/refunded/void...

    CONSTRAINT FK_Tickets_Bookings
        FOREIGN KEY (booking_id) REFERENCES Bookings(booking_id)
        ON DELETE CASCADE,

    CONSTRAINT FK_Tickets_BookingPassengers
        FOREIGN KEY (booking_passenger_id) REFERENCES BookingPassengers(booking_passenger_id)
);
GO

-- Thanh toán
CREATE TABLE Payments (
    payment_id UNIQUEIDENTIFIER NOT NULL 
        CONSTRAINT PK_Payments PRIMARY KEY,
        -- Note: Application code must generate UUID v7 for payment_id
    booking_id UNIQUEIDENTIFIER NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency_code CHAR(3) NOT NULL,
    payment_method_code VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,            -- success/failed/pending
    paid_at DATETIME2 NULL,
    transaction_ref VARCHAR(100) NULL,      -- mã giao dịch gateway
    idempotency_key VARCHAR(100) NULL,      -- idempotency key để prevent duplicate payments
    expires_at DATETIME2 NULL,              -- payment expiration date (15 minutes from creation)
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_Payments_Bookings
        FOREIGN KEY (booking_id) REFERENCES Bookings(booking_id),

    CONSTRAINT FK_Payments_Currencies
        FOREIGN KEY (currency_code) REFERENCES Currencies(currency_code),

    CONSTRAINT FK_Payments_PaymentMethods
        FOREIGN KEY (payment_method_code) REFERENCES PaymentMethods(payment_method_code)
);
GO

-- Reservations (Hybrid: Database + Redis)
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
);
GO

/* =========================================================
   INDEXES (GỢI Ý)
   ========================================================= */
CREATE INDEX IX_FlightInstances_FlightNumber_Date
    ON FlightInstances(flight_number, flight_date);

CREATE INDEX IDX_BaggageAllowance_FareClass
    ON BaggageAllowances(fare_class_code);

CREATE INDEX IDX_CabinService_CabinClass
    ON CabinServices(cabin_class_code);

CREATE INDEX IDX_CabinService_FareClass
    ON CabinServices(fare_class_code);

CREATE INDEX IDX_CabinService_Active
    ON CabinServices(is_active, cabin_class_code, fare_class_code);

CREATE INDEX IDX_RouteFarePrice_Route_FareClass
    ON RouteFarePrices(route_id, fare_class_code);

CREATE INDEX IDX_RouteFarePrice_EffectiveDates
    ON RouteFarePrices(effective_from, effective_to);

CREATE INDEX IDX_RouteFarePrice_Active
    ON RouteFarePrices(is_active, effective_from, effective_to);

-- Unique constraint: one active price per route + fare class + date range
CREATE UNIQUE INDEX UQ_RouteFarePrice_Active_Route_FareClass_DateRange
    ON RouteFarePrices(route_id, fare_class_code, effective_from, effective_to)
    WHERE is_active = 1 AND effective_to IS NOT NULL;

CREATE INDEX IX_FareDescriptionRules_Pattern_CabinType_Active
    ON FareDescriptionRules(fare_class_code_pattern, cabin_type, is_active);

CREATE INDEX IX_FareDescriptionRules_CabinType_Order_Active
    ON FareDescriptionRules(cabin_type, display_order, is_active);

CREATE INDEX IX_Bookings_UserId
    ON Bookings(user_id);

-- pnr_code đã có UNIQUE constraint trong CREATE TABLE, không cần thêm index riêng
-- CREATE INDEX IX_Bookings_PNR
--     ON Bookings(pnr_code);

CREATE INDEX IX_BookingSegments_FlightInstance
    ON BookingSegments(flight_instance_id);

CREATE INDEX IDX_BookingSegmentService_BookingSegment
    ON BookingSegmentServices(booking_segment_id);

CREATE INDEX IDX_BookingSegmentService_CabinService
    ON BookingSegmentServices(cabin_service_id);

CREATE INDEX IX_Payments_BookingId
    ON Payments(booking_id);

CREATE INDEX IX_Payments_IdempotencyKey
    ON Payments(idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX IX_Payments_ExpiresAt
    ON Payments(expires_at)
    WHERE expires_at IS NOT NULL;

CREATE INDEX IX_Reservations_UserId
    ON Reservations(user_id);

-- reservation_code đã có UNIQUE constraint trong CREATE TABLE, không cần thêm index riêng
-- CREATE INDEX IX_Reservations_Code
--     ON Reservations(reservation_code);

CREATE INDEX IX_Reservations_Status
    ON Reservations(status);

CREATE INDEX IX_Reservations_ExpiresAt
    ON Reservations(expires_at);

-- Tickets.ticket_number đã có UNIQUE constraint trong CREATE TABLE, không cần thêm index riêng
GO

/* =========================================================
   TRIGGERS updated_at
   ========================================================= */

-- Users
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
END;
GO

-- FlightInstances
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
END;
GO

-- Bookings
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
END;
GO

/* =========================================================
   TRIGGER GIỮ TRẠNG THÁI GHẾ
   (dựa trên BookingSegments.flight_seat_id)
   ========================================================= */
CREATE TRIGGER trg_BookingSegments_SeatAvailability_IUD
ON BookingSegments
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    -- Khóa các ghế mới được gán
    UPDATE s
    SET s.is_available = 0
    FROM FlightSeats s
    INNER JOIN inserted i
        ON s.flight_seat_id = i.flight_seat_id
    WHERE i.flight_seat_id IS NOT NULL;

    -- Mở lại các ghế bị bỏ nếu không còn ai dùng
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
END;
GO
