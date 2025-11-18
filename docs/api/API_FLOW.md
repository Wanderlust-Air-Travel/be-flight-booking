# API Flow - Flight Booking Backend

> **Sequence Diagrams**: Xem chi tiết sequence diagrams tại [API_SEQUENCE_DIAGRAMS.md](./API_SEQUENCE_DIAGRAMS.md)

## Tổng quan kiến trúc

```
┌─────────────┐
│   Client    │ (Frontend/Mobile App)
└──────┬──────┘
       │ HTTP/REST
       ▼
┌─────────────────────────────────────────────────────────┐
│              API Gateway (Port 3000)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │   Auth   │ │  Search  │ │ Booking  │ │Reservation│  │
│  │          │ │          │ │          │ │           │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘  │
│       │            │            │             │         │
│  ┌────┴────────────┴────────────┴─────────────┴─────┐  │
│  │         Microservices Communication               │  │
│  │         (TCP/RabbitMQ)                            │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
       │            │            │             │
       ▼            ▼            ▼             ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│   Auth   │ │  Search  │ │ Booking  │ │Reservation│
│ Service  │ │   MS     │ │    MS    │ │    MS     │
│          │ │ (4001)   │ │  (4004)  │ │  (4005)   │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
       │            │            │             │
       ▼            ▼            ▼             ▼
┌──────────────────────────────────────────────────┐
│         SQL Server Database (Port 1433)          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │  Users   │ │ Flights  │ │ Bookings │  ...    │
│  └──────────┘ └──────────┘ └──────────┘         │
└──────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────┐
│         Redis (Port 6379)                        │
│  ┌──────────────────────────────────────────┐   │
│  │      Reservations (TTL: 15 phút)         │   │
│  └──────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

---

## Danh sách API Endpoints

### Authentication APIs (`/auth`)

| Method | Endpoint | Mô tả | Auth Required |
|--------|----------|-------|---------------|
| POST | `/auth/register` | Đăng ký tài khoản mới | No |
| POST | `/auth/login` | Đăng nhập | No |
| POST | `/auth/refresh` | Làm mới access token | No |
| POST | `/auth/logout` | Đăng xuất | No |
| GET | `/auth/me` | Lấy thông tin user hiện tại | Yes |

### Search APIs (`/search`)

| Method | Endpoint | Mô tả | Auth Required |
|--------|----------|-------|---------------|
| GET | `/search/flights` | Tìm kiếm chuyến bay | No |
| GET | `/search/fare-options` | Lấy danh sách fare options (cabins) | No |

### Reservation APIs (`/reservations`)

| Method | Endpoint | Mô tả | Auth Required |
|--------|----------|-------|---------------|
| POST | `/reservations` | Tạo reservation (giữ chỗ tạm thời) | Yes |
| GET | `/reservations` | Danh sách reservations của user | Yes |
| GET | `/reservations/:id` | Lấy thông tin reservation theo ID | Yes |
| GET | `/reservations/code/:code` | Lấy thông tin reservation theo code | Yes |
| POST | `/reservations/:id/cancel` | Hủy reservation | Yes |
| POST | `/reservations/:id/extend` | Gia hạn reservation | Yes |

### Booking APIs (`/bookings`)

| Method | Endpoint | Mô tả | Auth Required |
|--------|----------|-------|---------------|
| POST | `/bookings` | Tạo booking mới | Yes |
| GET | `/bookings/:id/fare-details` | Lấy chi tiết fare đã chọn | Yes |
| GET | `/bookings/:id/payment-info` | Lấy thông tin thanh toán | Yes |
| PATCH | `/bookings/:id/passengers` | Cập nhật số lượng passengers | Yes |

### Routes APIs (`/routes`)

| Method | Endpoint | Mô tả | Auth Required |
|--------|----------|-------|---------------|
| POST | `/routes/:routeId/upload-image` | Upload ảnh cho route | Yes |

### Services APIs (`/services`)

| Method | Endpoint | Mô tả | Auth Required |
|--------|----------|-------|---------------|
| GET | `/services/deals` | Lấy danh sách flight deals | No |

---

## Flow chính: Booking Flow (Recommended)

### Flow 1: Đăng ký/Đăng nhập

```
┌─────────┐
│ Client  │
└────┬────┘
     │
     │ 1. POST /auth/register
     │    { fullname, email, password, phone }
     ▼
┌─────────┐
│   Auth  │ → Tạo user mới (UUID v7)
│ Service │ → Hash password
└────┬────┘ → Generate JWT tokens
     │
     │ Response: { user, access_token, refresh_token }
     ▼
┌─────────┐
│ Client  │ → Lưu tokens vào localStorage
└─────────┘

HOẶC

┌─────────┐
│ Client  │
└────┬────┘
     │
     │ 2. POST /auth/login
     │    { email, password }
     ▼
┌─────────┐
│   Auth  │ → Validate credentials
│ Service │ → Generate JWT tokens
└────┬────┘
     │
     │ Response: { user, access_token, refresh_token }
     ▼
┌─────────┐
│ Client  │ → Lưu tokens vào localStorage
└─────────┘
```

### Flow 2: Tìm kiếm và đặt vé (Complete Booking Flow)

```
┌─────────┐
│ Client  │
└────┬────┘
     │
     │ 1. GET /search/flights
     │    ?origin=HAN&destination=SGN&departDate=2025-11-17
     │    &tripType=one_way&adults=1&minors=0
     ▼
┌─────────┐
│ Search  │ → Query database: FlightInstances
│   MS    │ → Filter by route, date, available seats
└────┬────┘
     │
     │ Response: { tripType, outbound: [{ flightInstanceId, ... }] }
     ▼
┌─────────┐
│ Client  │ → Hiển thị danh sách chuyến bay
└────┬────┘ → User chọn một chuyến bay
     │
     │ 2. GET /search/fare-options
     │    ?flightInstanceId=xxx&cabinType=economy
     ▼
┌─────────┐
│ Search  │ → Query database: FareClasses
│   MS    │ → Filter by cabinType, available seats
└────┬────┘
     │
     │ Response: [{ fareClassCode, name, price, desc, ... }]
     ▼
┌─────────┐
│ Client  │ → Hiển thị các loại vé (Economy Saver Max, Smart, Flex)
└────┬────┘ → User chọn một fare class
     │
     │ 3. POST /reservations
     │    Authorization: Bearer <token>
     │    { flightInstanceId, fareClassCode, numberOfPassengers, currencyCode }
     ▼
┌─────────┐
│Reservation│ → Validate flight & fare class
│   MS    │ → Check available seats
│ (Redis) │ → Calculate price
└────┬────┘ → Store in Redis (TTL: 15 phút)
     │
     │ Response: { reservationId, reservationCode, totalAmount, expiresAt, ... }
     ▼
┌─────────┐
│ Client  │ → Lưu reservationId vào state
└────┬────┘ → Chuyển đến trang điền thông tin passenger
     │
     │ 4. POST /bookings?reservationId=xxx
     │    Authorization: Bearer <token>
     │    { passengers: [{ fullname, dob, gender, documentNumber, ... }],
     │      contactFullname, contactEmail, contactPhone, channel }
     ▼
┌─────────┐
│ Booking │ → Get reservation from Redis
│   MS    │ → Validate reservation (active, not expired, ownership)
│         │ → Create passengers (nếu chưa có)
│         │ → Create booking & booking segments
│         │ → Calculate total amount
│         │ → Generate PNR code
└────┬────┘ → Auto-cancel reservation
     │
     │ Response: { bookingId, pnrCode, totalAmount, status }
     ▼
┌─────────┐
│ Client  │ → Hiển thị thông tin booking
└────┬────┘
     │
     │ 5. GET /bookings/:id/fare-details
     │    Authorization: Bearer <token>
     ▼
┌─────────┐
│ Booking │ → Query booking segments
│   MS    │ → Get fare class descriptions
└────┬────┘
     │
     │ Response: { fareClassName, descriptions, priceOneWay, totalPrice }
     ▼
┌─────────┐
│ Client  │ → Hiển thị chi tiết fare
└────┬────┘
     │
     │ 6. GET /bookings/:id/payment-info
     │    Authorization: Bearer <token>
     ▼
┌─────────┐
│ Booking │ → Query booking & contact info
│   MS    │
└────┬────┘
     │
     │ Response: { totalAmount, currencyCode, contactFullname, ... }
     ▼
┌─────────┐
│ Client  │ → Hiển thị trang thanh toán
└─────────┘
```

---

## Flow chi tiết từng API

### 1. Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                      │
└─────────────────────────────────────────────────────────────┘

1. REGISTER
   POST /auth/register
   Body: { fullname, email, password, phone }
   → AuthService.register()
   → Hash password (bcrypt)
   → Generate UUID v7 cho user_id
   → Save to Users table
   → Generate JWT tokens (access_token, refresh_token)
   → Return: { user, access_token, refresh_token }

2. LOGIN
   POST /auth/login
   Body: { email, password }
   → AuthService.login()
   → Find user by email
   → Compare password
   → Generate JWT tokens
   → Return: { user, access_token, refresh_token }

3. REFRESH TOKEN
   POST /auth/refresh
   Body: { userId, refresh_token }
   → AuthService.refresh()
   → Validate refresh_token
   → Generate new tokens
   → Return: { access_token, refresh_token }

4. GET CURRENT USER
   GET /auth/me
   Headers: Authorization: Bearer <token>
   → JwtAuthGuard extracts userId from token
   → Return: { userId, email }
```

### 2. Search Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      SEARCH FLOW                            │
└─────────────────────────────────────────────────────────────┘

1. SEARCH FLIGHTS
   GET /search/flights?origin=HAN&destination=SGN&departDate=2025-11-17
       &tripType=one_way&adults=1&minors=0
   
   → SearchController.searchFlights()
   → Search Microservice (TCP port 4001)
   → Query database:
     - Find route by origin & destination airports
     - Find FlightInstances for departDate
     - Filter by available seats >= totalPassengers
     - Include flight schedule info, aircraft, airports
   → Return: { tripType, outbound: [...], inbound: [...] (nếu round_trip) }

2. GET FARE OPTIONS
   GET /search/fare-options?flightInstanceId=xxx&cabinType=economy
   
   → SearchController.getFareOptions()
   → Search Microservice
   → Query database:
     - Find FlightInstance by ID
     - Find FareClasses by cabinType
     - Calculate available seats for each fare class
     - Get fare class descriptions
   → Return: [{ fareClassCode, name, typeTicket, price, availableSeats, desc, ... }]
```

### 3. Reservation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   RESERVATION FLOW                          │
└─────────────────────────────────────────────────────────────┘

1. CREATE RESERVATION
   POST /reservations
   Headers: Authorization: Bearer <token>
   Body: { flightInstanceId, fareClassCode, numberOfPassengers, currencyCode }
   
   → ReservationController.createReservation()
   → Extract userId from JWT token
   → Reservation Microservice (TCP port 4005)
   → Validate:
     - Flight instance exists
     - Fare class exists
     - Available seats >= numberOfPassengers
   → Calculate price from fare class
   → Generate reservationId (UUID v7) & reservationCode (6 chars)
   → Store in Redis:
     Key: reservation:{reservationId}
     Value: { reservationId, userId, flightInstanceId, fareClassCode, ... }
     TTL: 900 seconds (15 phút)
   → Return: { reservationId, reservationCode, totalAmount, expiresAt, ... }

2. GET RESERVATION
   GET /reservations/:id
   Headers: Authorization: Bearer <token>
   
   → ReservationController.getReservation()
   → Reservation Microservice
   → Get from Redis by ID or code (auto-detect)
   → Check if expired
   → Return: { reservationId, reservationCode, ... }

3. LIST RESERVATIONS
   GET /reservations
   Headers: Authorization: Bearer <token>
   
   → ReservationController.listReservations()
   → Extract userId from JWT
   → Reservation Microservice
   → Scan Redis for user's reservations
   → Filter by status = 'active' and not expired
   → Return: [{ reservationId, ... }, ...]

4. CANCEL RESERVATION
   POST /reservations/:id/cancel
   Headers: Authorization: Bearer <token>
   
   → ReservationController.cancelReservation()
   → Reservation Microservice
   → Get reservation from Redis
   → Validate status = 'active'
   → Delete from Redis
   → Return: { success: true, message: "..." }

5. EXTEND RESERVATION
   POST /reservations/:id/extend
   Headers: Authorization: Bearer <token>
   Body: { additionalSeconds: 600 }
   
   → ReservationController.extendReservation()
   → Reservation Microservice
   → Get reservation from Redis
   → Validate status = 'active' and not expired
   → Update TTL in Redis
   → Return: { reservationId, expiresAt, ttl, ... }
```

### 4. Booking Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     BOOKING FLOW                            │
└─────────────────────────────────────────────────────────────┘

1. CREATE BOOKING (FROM RESERVATION - Recommended)
   POST /bookings?reservationId=xxx
   Headers: Authorization: Bearer <token>
   Body: { passengers: [...], contactFullname, contactEmail, contactPhone, channel }
   
   → BookingController.createBooking()
   → Extract userId from JWT token
   → Booking Microservice (TCP port 4004)
   → Get reservation from Redis (via Reservation MS)
   → Validate:
     - Reservation exists and active
     - Reservation not expired
     - Reservation belongs to user (userId match)
     - Number of passengers matches reservation
   → Start database transaction:
     a. Create/Find passengers:
        - If passengerId provided → use existing
        - If not → create new passenger (link to user)
        - Auto-detect duplicate by documentNumber
     b. Create booking record
     c. Create booking segments (from reservation)
     d. Create booking passengers
     e. Calculate total amount
     f. Generate PNR code (6 alphanumeric chars)
   → Commit transaction
   → Auto-cancel reservation (via Reservation MS)
   → Return: { bookingId, pnrCode, totalAmount, status }

2. CREATE BOOKING (DIRECT - Legacy)
   POST /bookings
   Headers: Authorization: Bearer <token>
   Body: { currencyCode, passengers: [...], segments: [...], contactInfo, ... }
   
   → Similar to above, but:
     - No reservation validation
     - Segments must be provided in request body
     - Frontend must manage state

3. GET FARE DETAILS
   GET /bookings/:id/fare-details
   Headers: Authorization: Bearer <token>
   
   → BookingController.getBookingFareDetails()
   → Booking Microservice
   → Query booking & booking segments
   → Get fare class descriptions
   → Calculate pricing
   → Return: { fareClassName, descriptions, priceOneWay, totalPrice }

4. GET PAYMENT INFO
   GET /bookings/:id/payment-info
   Headers: Authorization: Bearer <token>
   
   → BookingController.getBookingPaymentInfo()
   → Booking Microservice
   → Query booking & contact info
   → Return: { totalAmount, currencyCode, contactFullname, contactEmail, ... }

5. UPDATE PASSENGERS
   PATCH /bookings/:id/passengers
   Headers: Authorization: Bearer <token>
   Body: { adults: 2, minors: 1 }
   
   → BookingController.updateBookingPassengers()
   → Booking Microservice
   → Update booking passenger count
   → Return: { success: true, message: "...", totalPassengers }
```

### 5. Routes Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     ROUTES FLOW                             │
└─────────────────────────────────────────────────────────────┘

1. UPLOAD ROUTE IMAGE
   POST /routes/:routeId/upload-image
   Headers: Authorization: Bearer <token>
   Content-Type: multipart/form-data
   Body: { image: <file> }
   
   → RoutesController.uploadImage()
   → Multer middleware saves file to: public/images/routes/{routeId}.jpg
   → Routes Microservice (TCP port 4003)
   → Update Routes table: image_url = '/images/routes/{routeId}.jpg'
   → Return: { routeId, imageUrl, message }
```

### 6. Services Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    SERVICES FLOW                            │
└─────────────────────────────────────────────────────────────┘

1. GET FLIGHT DEALS
   GET /services/deals
   
   → ServicesController.getDeals()
   → Services Microservice (TCP port 4002)
   → Query database:
     - Get all domestic routes
     - Find available flights in next 30 days
     - Calculate average price from BookingSegments (historical pricing)
     - Create deals for one-way and round-trip (if return route exists)
   → Format prices with Vietnamese format
   → Return: { deals: [{ image, title, link, startDate, endDate, tripType, service, price }, ...] }
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT REQUEST                              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    API GATEWAY (Port 3000)                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 1. Validate Request (ValidationPipe)                         │  │
│  │ 2. Extract JWT Token (if required)                           │  │
│  │ 3. Route to appropriate Controller                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Auth Service │    │ Microservice │    │ Microservice │
│  (Direct DB) │    │ Communication│    │ Communication│
└──────────────┘    │  (TCP/Rabbit)│    │  (TCP/Rabbit)│
        │           └──────┬───────┘    └──────┬───────┘
        │                  │                    │
        ▼                  ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   SQL DB     │    │   Search MS  │    │  Booking MS  │
│              │    │   (Port 4001)│    │  (Port 4004) │
└──────────────┘    └──────┬───────┘    └──────┬───────┘
                           │                    │
                           ▼                    ▼
                    ┌──────────────┐    ┌──────────────┐
                    │   SQL DB     │    │   SQL DB     │
                    │              │    │              │
                    └──────────────┘    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Reservation  │
                    │     MS       │
                    │  (Port 4005) │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │    Redis     │
                    │  (Port 6379) │
                    └──────────────┘
```

---

## Authentication & Authorization

### JWT Token Flow

```
1. User Login/Register
   → Generate JWT tokens:
     - access_token: Expires in 15 minutes
     - refresh_token: Expires in 7 days

2. Client stores tokens (localStorage/sessionStorage)

3. For authenticated requests:
   Headers: Authorization: Bearer <access_token>
   
4. API Gateway:
   → JwtAuthGuard extracts token
   → Validates token
   → Extracts userId, email
   → Attaches to req.user

5. If access_token expired (401):
   → Client calls POST /auth/refresh
   → Get new tokens
   → Retry original request
```

### Protected Endpoints

Tất cả endpoints sau yêu cầu JWT authentication:
- `/reservations/*` (tất cả)
- `/bookings/*` (tất cả)
- `/routes/*` (tất cả)
- `/auth/me`

Public endpoints (không cần auth):
- `/auth/register`
- `/auth/login`
- `/auth/refresh`
- `/auth/logout`
- `/search/*`
- `/services/*`

---

## Error Handling

### Standard Error Response

```json
{
  "statusCode": 400,
  "message": "Error message or array of messages",
  "error": "Bad Request"
}
```

### Common Status Codes

- `200 OK`: Request thành công
- `201 Created`: Tạo mới thành công
- `400 Bad Request`: Validation error hoặc thiếu tham số
- `401 Unauthorized`: Chưa đăng nhập hoặc token không hợp lệ
- `404 Not Found`: Không tìm thấy resource
- `500 Internal Server Error`: Lỗi server

### Microservice Connection Errors

Nếu microservice không chạy, API Gateway sẽ trả về:
```json
{
  "statusCode": 500,
  "message": "{Service} microservice is not running. Please start it with: npm run start:{service}:dev",
  "error": "Internal Server Error"
}
```

---

## Notes

1. **UUID v7**: Tất cả IDs sử dụng UUID v7 (time-ordered UUID)
2. **Reservation TTL**: Mặc định 15 phút (900 seconds), có thể config qua `REDIS_RESERVATION_TTL`
3. **Transaction Safety**: Booking creation sử dụng database transaction
4. **Auto-cleanup**: Reservation tự động bị cancel sau khi tạo booking thành công
5. **Passenger Reuse**: Hệ thống tự động detect và reuse passenger nếu cùng `documentNumber`
6. **Contact Info Logic**: Tự động điền contact info từ user hoặc passenger nếu không được cung cấp

---

## Swagger Documentation

Xem và test API trực tiếp tại: `http://localhost:3000/api-docs`

---

## Sequence Diagrams

Để xem chi tiết sequence diagrams mô tả flow xử lý của từng API, vui lòng xem file: **[API_SEQUENCE_DIAGRAMS.md](./API_SEQUENCE_DIAGRAMS.md)**

File này chứa các sequence diagrams cho:
- Complete Booking Flow (từ Search đến Payment)
- System Architecture Flow
- Microservices Communication Pattern
- Authentication & Authorization Flow
- Error Handling Flow

Tất cả diagrams được vẽ bằng Mermaid và có thể render trực tiếp trên GitHub hoặc các Markdown viewers hỗ trợ Mermaid.

