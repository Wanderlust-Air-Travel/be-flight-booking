```mermaid
erDiagram
    %% ============ CORE ACTORS ============
    Users {
        UNIQUEIDENTIFIER user_id PK
        NVARCHAR fullname
        VARCHAR email
        VARCHAR password_hash
        VARCHAR phone
        DATETIME2 created_at
        DATETIME2 updated_at
        VARCHAR refresh_token
        DATETIME2 refresh_token_expires_at
        VARCHAR forgot_password_token
        DATETIME2 forgot_password_token_expires_at
        BIT is_active
    }

    Passengers {
        UNIQUEIDENTIFIER passenger_id PK
        UNIQUEIDENTIFIER user_id FK
        NVARCHAR fullname
        DATE dob
        NVARCHAR gender
        VARCHAR document_number
        VARCHAR loyalty_number
        DATETIME2 created_at
    }

    %% ============ AIRPORTS & ROUTES ============
    Airports {
        UNIQUEIDENTIFIER airport_id PK
        CHAR iata_code
        CHAR icao_code
        NVARCHAR name
        NVARCHAR city
        NVARCHAR country
        VARCHAR timezone
    }

    Routes {
        UNIQUEIDENTIFIER route_id PK
        UNIQUEIDENTIFIER origin_airport_id FK
        UNIQUEIDENTIFIER destination_airport_id FK
        INT distance_km
        BIT is_domestic
        NVARCHAR image_url
        NVARCHAR service_link
        DATETIME2 created_at
    }

    %% ============ AIRCRAFT & SEAT CONFIG ============
    AircraftTypes {
        UNIQUEIDENTIFIER aircraft_type_id PK
        VARCHAR code
        NVARCHAR manufacturer
        NVARCHAR model
        INT total_seats
    }

    Aircrafts {
        UNIQUEIDENTIFIER aircraft_id PK
        UNIQUEIDENTIFIER aircraft_type_id FK
        VARCHAR registration
        BIT in_service
    }

    CabinClasses {
        VARCHAR cabin_class_code PK
        NVARCHAR name
    }

    FareClasses {
        VARCHAR fare_class_code PK
        VARCHAR cabin_class_code FK
        NVARCHAR description
        NVARCHAR change_rule
        NVARCHAR refund_rule
    }

    SeatConfigurations {
        UNIQUEIDENTIFIER seat_config_id PK
        UNIQUEIDENTIFIER aircraft_type_id FK
        VARCHAR seat_number
        VARCHAR cabin_class_code FK
        VARCHAR seat_type
        BIT is_exit_row
    }

    %% ============ FLIGHT SCHEDULE / INSTANCE / SEATS ============
    FlightSchedules {
        UNIQUEIDENTIFIER flight_schedule_id PK
        VARCHAR flight_number
        UNIQUEIDENTIFIER route_id FK
        UNIQUEIDENTIFIER aircraft_type_id FK
        TIME departure_time_local
        TIME arrival_time_local
        CHAR operating_days
        DATE effective_from
        DATE effective_to
        VARCHAR status
    }

    FlightInstances {
        UNIQUEIDENTIFIER flight_instance_id PK
        UNIQUEIDENTIFIER flight_schedule_id FK
        DATE flight_date
        VARCHAR flight_number
        UNIQUEIDENTIFIER aircraft_id FK
        DATETIME2 departure_datetime_local
        DATETIME2 arrival_datetime_local
        VARCHAR status
        DATETIME2 created_at
        DATETIME2 updated_at
    }

    FlightSeats {
        UNIQUEIDENTIFIER flight_seat_id PK
        UNIQUEIDENTIFIER flight_instance_id FK
        UNIQUEIDENTIFIER seat_config_id FK
        VARCHAR seat_number
        BIT is_available
    }

    %% ============ CURRENCY / PAYMENT METHODS ============
    Currencies {
        CHAR currency_code PK
        NVARCHAR name
    }

    PaymentMethods {
        VARCHAR payment_method_code PK
        NVARCHAR name
        BIT is_active
    }

    %% ============ RESERVATIONS (Hybrid: Database + Redis) ============
    Reservations {
        UNIQUEIDENTIFIER reservation_id PK
        VARCHAR reservation_code
        UNIQUEIDENTIFIER user_id FK
        NVARCHAR segments_json
        INT number_of_passengers
        DECIMAL total_amount
        CHAR currency_code FK
        VARCHAR status
        DATETIME2 expires_at
        DATETIME2 created_at
        DATETIME2 converted_at
    }

    %% ============ BOOKINGS / SEGMENTS / TICKETS / PAYMENTS ============
    Bookings {
        UNIQUEIDENTIFIER booking_id PK
        VARCHAR pnr_code
        UNIQUEIDENTIFIER user_id FK
        CHAR currency_code FK
        DECIMAL total_amount
        VARCHAR status
        VARCHAR channel
        NVARCHAR contact_fullname
        VARCHAR contact_email
        VARCHAR contact_phone
        DATETIME2 created_at
        DATETIME2 updated_at
    }

    BookingPassengers {
        UNIQUEIDENTIFIER booking_passenger_id PK
        UNIQUEIDENTIFIER booking_id FK
        UNIQUEIDENTIFIER passenger_id FK
        VARCHAR passenger_type
    }

    BookingSegments {
        UNIQUEIDENTIFIER booking_segment_id PK
        UNIQUEIDENTIFIER booking_id FK
        UNIQUEIDENTIFIER booking_passenger_id FK
        UNIQUEIDENTIFIER flight_instance_id FK
        UNIQUEIDENTIFIER flight_seat_id FK
        VARCHAR fare_class_code FK
        DECIMAL base_fare
        DECIMAL tax_amount
        DECIMAL fee_amount
        VARCHAR status
    }

    Tickets {
        UNIQUEIDENTIFIER ticket_id PK
        UNIQUEIDENTIFIER booking_id FK
        UNIQUEIDENTIFIER booking_passenger_id FK
        VARCHAR ticket_number
        VARCHAR status
        DATETIME2 issued_at
    }

    Payments {
        UNIQUEIDENTIFIER payment_id PK
        UNIQUEIDENTIFIER booking_id FK
        DECIMAL amount
        CHAR currency_code FK
        VARCHAR payment_method_code FK
        VARCHAR status
        DATETIME2 paid_at
        VARCHAR transaction_ref
        VARCHAR idempotency_key
        DATETIME2 expires_at
        DATETIME2 created_at
    }

    %% ============ RELATIONSHIPS ============

    %% Users & Passengers & Reservations & Bookings
    Users ||--o{ Passengers   : "user_id"
    Users ||--o{ Reservations : "user_id"
    Users ||--o{ Bookings     : "user_id"

    %% Airports & Routes
    Airports ||--o{ Routes : "origin/destination"

    %% Routes -> FlightSchedules
    Routes ||--o{ FlightSchedules : "route_id"

    %% AircraftTypes / Aircrafts / SeatConfig / FlightSchedules
    AircraftTypes ||--o{ Aircrafts           : "aircraft_type_id"
    AircraftTypes ||--o{ SeatConfigurations  : "aircraft_type_id"
    AircraftTypes ||--o{ FlightSchedules     : "aircraft_type_id"

    %% Cabin / Fare / SeatConfig
    CabinClasses ||--o{ FareClasses         : "cabin_class_code"
    CabinClasses ||--o{ SeatConfigurations  : "cabin_class_code"
    FareClasses  ||--o{ BookingSegments     : "fare_class_code"

    %% FlightSchedules -> FlightInstances
    FlightSchedules ||--o{ FlightInstances : "flight_schedule_id"
    Aircrafts       ||--o{ FlightInstances : "aircraft_id"

    %% FlightInstances -> FlightSeats
    FlightInstances    ||--o{ FlightSeats        : "flight_instance_id"
    SeatConfigurations ||--o{ FlightSeats        : "seat_config_id"
    FlightSeats        ||--o{ BookingSegments    : "flight_seat_id"
    FlightInstances    ||--o{ BookingSegments    : "flight_instance_id"

    %% Currency / PaymentMethods
    Currencies     ||--o{ Reservations : "currency_code"
    Currencies     ||--o{ Bookings     : "currency_code"
    Currencies     ||--o{ Payments     : "currency_code"
    PaymentMethods ||--o{ Payments : "payment_method_code"

    %% Bookings / BookingPassengers / Segments / Tickets / Payments
    Bookings          ||--o{ BookingPassengers : "booking_id"
    Passengers        ||--o{ BookingPassengers : "passenger_id"

    Bookings          ||--o{ BookingSegments   : "booking_id"
    BookingPassengers ||--o{ BookingSegments   : "booking_passenger_id"

    Bookings          ||--o{ Tickets           : "booking_id"
    BookingPassengers ||--o{ Tickets           : "booking_passenger_id"

    Bookings          ||--o{ Payments          : "booking_id"
```

## Giải thích ngắn gọn (BE-focused)

- **Users & Passengers**
  - Users: tài khoản đăng nhập, quản lý bảo mật và trạng thái.
  - Passengers: hồ sơ hành khách dùng cho bay/ra vé; `user_id` NULL để hỗ trợ khách vãng lai/đại lý.

- **Airports & Routes**
  - Airports: chuẩn hóa IATA/ICAO, timezone phục vụ hiển thị/convert giờ.
  - Routes: unique theo cặp (origin, destination) để tránh trùng tuyến.
    - `image_url`: Đường dẫn hình ảnh deal, format `/images/routes/{route_id}.jpg` (route_id là UUID v7 - 36 ký tự, length = 55)
    - `service_link`: Link đến trang service, format `/service/{route_id}` (route_id là UUID v7 - 36 ký tự, length = 45)
    - Có CHECK constraints để validate format và đảm bảo route_id trong URL khớp với route_id của record
    - Trigger tự động generate `image_url` và `service_link` khi INSERT/UPDATE nếu NULL hoặc không đúng format

- **Fleet & Seating**
  - AircraftTypes/Aircrafts: loại tàu bay vs máy bay thực tế (registration unique).
  - CabinClasses/FareClasses: phân lớp khoang vs booking class (Y/M/B/K…).
  - SeatConfigurations: layout ghế theo loại máy bay; template sinh ghế cho chuyến thực tế.

- **Operation**
  - FlightSchedules: lịch định nghĩa (route, loại máy bay, dải hiệu lực, ngày hoạt động).
  - FlightInstances: chuyến theo ngày (copy `flight_number`, có thể gán `aircraft_id` thực tế).
  - FlightSeats: ghế của một instance; unique (instance, seat_number); cờ `is_available`.

- **Finance**
  - Currencies: mã tiền (VND/USD…).
  - PaymentMethods: từ điển phương thức thanh toán (Card/BankTransfer/Momo…).

- **Reservations (Hybrid: Database + Redis)**
  - Reservations: Giữ chỗ tạm thời trước khi tạo booking (Hybrid Approach).
    - Database: Persistent storage, audit trail, analytics (status: `pending`, `expired`, `converted`, `cancelled`).
    - Redis: Fast cache với TTL 15 phút (auto cleanup).
    - `reservation_code` unique (6 alphanumeric), `segments_json` lưu multi-segment (round-trip support).
    - Status tracking: `pending` → `converted` (khi tạo booking) hoặc `expired`/`cancelled`.
    - `converted_at`: Timestamp khi booking được tạo từ reservation này.
    - Get flow: Try Redis first (fast) → Fallback to Database → Re-cache if needed.

- **Commerce (Aggregate root: Booking)**
  - Bookings: PNR unique, `user_id` nullable, tổng tiền/trạng thái + thông tin liên hệ.
  - BookingPassengers: mapping Passenger vào Booking; unique (booking_id, passenger_id).
  - BookingSegments: mỗi hành khách trên mỗi chặng (flight_instance), có thể có `flight_seat_id`, `fare_class_code`, giá (base/tax/fee), trạng thái.
  - Tickets: vé điện tử (ticket_number unique), gắn Booking + BookingPassenger.
  - Payments: thanh toán cho Booking (số tiền, tiền tệ, phương thức, trạng thái, transaction_ref).
    - `idempotency_key`: Idempotency key để prevent duplicate payments.
    - `expires_at`: Payment expiration date (15 minutes from creation).

- **Ràng buộc chính**
  - Unique: Routes(origin,destination), FlightSchedules(flight_number,from,to), FlightInstances(flight_number,flight_date), FlightSeats(instance,seat_number), BookingPassengers(booking,passenger), Reservations.reservation_code, Bookings.pnr_code, Tickets.ticket_number.
  - FK với cascade hợp lý (xóa Booking dọn dẹp chi tiết).

- **Seat availability (logic DB)**
  - Trigger trên BookingSegments auto cập nhật `FlightSeats.is_available` khi I/U/D:
    - Gán ghế → khóa ghế (is_available=0).
    - Bỏ ghế → mở lại nếu không còn ai dùng.

- **Luồng tối thiểu**
  1) Publish mạng tuyến + lịch → generate instances theo ngày.
  2) Sinh seat map từ SeatConfigurations vào FlightSeats theo instance.
  3) Tạo Booking (PNR), add BookingPassengers, add BookingSegments (có thể chưa gán ghế).
  4) Gán/đổi ghế bằng cách cập nhật `booking_segment.flight_seat_id`.
  5) Thanh toán → phát hành Tickets, cập nhật trạng thái.

- **Thực thi/Query khuyến nghị**
  - Tìm instance theo (flight_number, flight_date) để tra cứu chặng.
  - Lấy seat map: FlightSeats by instance, join SeatConfigurations, filter `is_available`.
  - Lấy booking theo `pnr_code` (unique) và liệt kê segments/tickets/payments theo `booking_id`.