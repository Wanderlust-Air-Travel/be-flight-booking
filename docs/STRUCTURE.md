# Cấu trúc Backend - Flight Booking

## Tổng quan

Backend sử dụng **Microservices Architecture với Shared Database**:
- **API Gateway** (port 3000): REST API entry point - nơi FE gọi API
- **Microservices**: Xử lý business logic phức tạp (search, booking, payment...)
- **Shared Database**: Tất cả services dùng chung 1 SQL Server database
- **Shared Code**: Entities, types, config được share giữa tất cả services

## Cấu trúc thư mục

**Lưu ý về Code Organization:**
- **Interfaces**: Tất cả interfaces được tách riêng vào folder `interfaces/` của mỗi service
- **DTOs**: Request/Response DTOs nằm trong folder `dto/`
- **Services**: Business logic nằm trong folder `services/` hoặc file `*.service.ts`
- **Controllers**: Message handlers nằm trong file `*.controller.ts`

```
src/
├── shared/                    # Code dùng chung
│   ├── entities/              # Database models (TypeORM)
│   ├── types/                 # TypeScript types (shared types only)
│   │   ├── auth/              # Authentication types (token-payload, login-response, etc.)
│   │   ├── database/          # Database-related types (sql-config.interface.ts)
│   │   └── express/           # Express type extensions
│   ├── config/                # Configuration
│   └── constants/             # Constants (enums, etc.)
│
├── api-gateway/               # REST API (port 3000)
│   ├── modules/               # Feature modules
│   │   ├── auth/              # Authentication (login, register)
│   │   ├── user/              # User management
│   │   ├── search/            # Search flights (proxy to microservice)
│   │   ├── services/          # Services (deals, etc.)
│   │   ├── routes/            # Routes management
│   │   ├── booking/           # Booking management (proxy to microservice)
│   │   ├── reservation/       # Reservation management (proxy to microservice)
│   │   ├── payment/           # Payment management (proxy to microservice)
│   │   └── email/             # Email management (proxy to microservice)
│   ├── app.module.ts          # Root module
│   └── main.ts                # Entry point
│
├── microservices/             # Microservices (TCP message handlers)
│   ├── search/                # Search microservice (port 4001)
│   │   ├── controllers/       # Message handlers
│   │   ├── services/          # Business logic
│   │   ├── dto/               # Request/Response DTOs
│   │   ├── interfaces/        # Service interfaces
│   │   │   ├── flight-result.interface.ts
│   │   │   └── index.ts
│   │   └── main.search.ts     # Entry point
│   ├── services/              # Services microservice (port 4002)
│   │   ├── controllers/       # Message handlers
│   │   ├── services/          # Business logic
│   │   ├── dto/               # Request/Response DTOs
│   │   ├── services.messages.ts  # TCP config
│   │   └── main.services.ts   # Entry point
│   ├── routes/                # Routes microservice (port 4003)
│   │   ├── controllers/       # Message handlers
│   │   ├── services/          # Business logic
│   │   ├── dto/               # Request/Response DTOs
│   │   ├── routes.messages.ts # TCP config
│   │   └── main.routes.ts     # Entry point
│   ├── booking/               # Booking microservice (port 4004)
│   │   ├── controllers/       # Message handlers
│   │   ├── services/          # Business logic
│   │   ├── dto/               # Request/Response DTOs
│   │   ├── booking.messages.ts # TCP config
│   │   └── main.booking.ts    # Entry point
│   ├── reservation/           # Reservation microservice (port 4005)
│   │   ├── controllers/       # Message handlers
│   │   ├── services/          # Business logic (Redis-based)
│   │   ├── dto/               # Request/Response DTOs
│   │   ├── reservation.messages.ts # TCP config
│   │   └── main.reservation.ts # Entry point
│   └── payment/               # Payment microservice (port 4006)
│       ├── controllers/       # Message handlers
│       ├── services/          # Business logic
│       ├── dto/               # Request/Response DTOs
│       ├── interfaces/        # Service interfaces
│       │   ├── payment-gateway.interface.ts
│       │   └── index.ts
│       ├── gateways/          # Payment gateway implementations
│       │   ├── payment-gateway.factory.ts
│       │   ├── mock-payment.gateway.ts
│       │   └── vnpay.gateway.example.ts
│       ├── payment.messages.ts # TCP config
│       └── main.payment.ts    # Entry point
│   └── email/                 # Email microservice (port 4007)
│       ├── controllers/       # Message handlers
│       ├── services/          # Business logic
│       │   ├── gmail-api.service.ts      # Gmail API integration
│       │   ├── email-queue.service.ts    # Queue management
│       │   └── email-template.service.ts # Email templates
│       ├── interfaces/        # Service interfaces
│       │   ├── email-queue.interface.ts
│       │   ├── email-template.interface.ts
│       │   └── index.ts
│       ├── dto/               # Request/Response DTOs
│       ├── email.messages.ts  # TCP config
│       └── main.email.ts      # Entry point
│
└── scripts/                   # Database scripts
    └── seed-domestic.ts       # Seed domestic flights data

tools/                         # Utility scripts and tools
├── test-db-connection.ts      # Test database connection (TypeScript)
├── test-otp-email.ts          # Test OTP email sending (TypeScript)
└── Flight-Booking-API.postman_collection.json  # Postman collection

docker/                        # Docker-related scripts
├── wait-for-database.ts       # Wait for SQL Server to be ready (TypeScript)
├── init-database.ts           # Initialize database and run migrations (TypeScript)
└── start-all.ts               # Start all microservices (TypeScript)
```

## Luồng xử lý request từ FE

### Example: Search Flights

```
FE → GET /search/flights?origin=HAN&destination=SGN...
  ↓
API Gateway (port 3000)
  ↓ Validate request
  ↓ Send message to microservice
  ↓
Search Microservice (port 4001)
  ↓ Query database
  ↓ Process business logic
  ↓ Return results
  ↓
API Gateway → Response to FE
```

## API Endpoints cho FE

### Base URL
- **API Gateway**: `http://localhost:3000`
- **Swagger Docs**: `http://localhost:3000/api-docs`

### Authentication
- `POST /auth/register` - Đăng ký
- `POST /auth/login` - Đăng nhập
- `POST /auth/refresh` - Refresh token
- `POST /auth/logout` - Đăng xuất

### Search Flights
- `GET /search/flights` - Tìm kiếm chuyến bay
  - **Query params**:
    - `origin` (required): IATA code (3 chars, e.g., "HAN")
    - `destination` (required): IATA code (3 chars, e.g., "SGN")
    - `departDate` (required): YYYY-MM-DD (e.g., "2025-11-17")
    - `returnDate` (optional): YYYY-MM-DD (required nếu `tripType=round_trip`)
    - `tripType` (optional): "one_way" hoặc "round_trip"
      - **Auto-set logic**: Nếu không truyền `tripType`:
        - Không có `returnDate` → mặc định `tripType=one_way`
        - Có `returnDate` → mặc định `tripType=round_trip`
    - `adults` (required): Số người lớn (≥1)
    - `minors` (required): Số trẻ em (≥0)
  
  - **Response**:
    ```json
    {
      "tripType": "one_way",
      "outbound": [
        {
          "flightInstanceId": "...",
          "flightNumber": "BB0100",
          "departureLocal": "2025-11-17T08:00:00",
          "arrivalLocal": "2025-11-17T10:10:00",
          "availableSeats": 180,
          "origin": { "iata": "HAN", "name": "...", "city": "..." },
          "destination": { "iata": "SGN", "name": "...", "city": "..." }
        }
      ],
      "inbound": [...], // Chỉ có nếu tripType=round_trip
      "totalPassengers": 1
    }
    ```

### Search Flights - Fare Options
- `GET /search/fare-options` - Lấy danh sách fare options (cabins) cho một flight instance
  - **Query params**:
    - `flightInstanceId` (required): UUID v7
    - `cabinType` (required): "economy" hoặc "business"
  - **Response**: Array trực tiếp `[{ fareClassCode, name, typeTicket, price, availableSeats, desc, ... }]`
    - Mỗi fare option có `desc` array với `text` và `status` (true/false)
    - Không có group wrapper (đơn giản hơn, phù hợp với UUID v7 system)

### Services
- `GET /services/deals` - Lấy danh sách flight deals (ưu đãi chuyến bay)

### Reservations
- `POST /reservations` - Tạo reservation (giữ chỗ tạm thời)
  - **Auth**: Required (JWT Bearer Token)
  - **Request**: `{ flightInstanceId, fareClassCode, numberOfPassengers, currencyCode? }`
  - **Response**: `{ reservationId, reservationCode, totalAmount, expiresAt, status, ttl, ... }`
  - **Lưu ý**: 
    - Reservation được lưu trong **Redis** (không phải database)
    - Tự động expire sau 15 phút (configurable)
    - Backend tự động validate availability và tính giá
    - Cần Reservation Microservice (port 4005) và Redis chạy
- `GET /reservations/:id` - Lấy reservation theo ID hoặc code (auto-detect)
  - **Auth**: Required (JWT Bearer Token)
  - **Response**: Reservation details với TTL còn lại
- `GET /reservations/code/:code` - Lấy reservation theo code (6 alphanumeric)
  - **Auth**: Required (JWT Bearer Token)
- `POST /reservations/:id/cancel` - Hủy reservation
  - **Auth**: Required (JWT Bearer Token)

### Bookings
- `POST /bookings` - Tạo booking mới
  - **Authentication**: Required (JWT Bearer Token)
  - **Body**: 
    - `currencyCode` (required)
    - `contactFullname`, `contactEmail`, `contactPhone` (optional - tự động lấy từ user nếu không có)
    - `channel` (optional)
    - `passengers[]` (required):
      - **Option 1**: `{ passengerId, passengerType }` - Sử dụng passenger đã có
      - **Option 2**: `{ passengerType, fullname, dob, gender, documentNumber }` - Tạo passenger mới
    - `segments[]` (required): `{ flightInstanceId, fareClassCode, baseFare, taxAmount, feeAmount }`
  - **Response**: `{ bookingId, pnrCode, totalAmount, currencyCode, status }`
  - **Lưu ý**: 
    - `userId` không cần truyền - tự động extract từ JWT token
    - Nếu không có `passengerId`, passenger sẽ được tự động tạo và link với user
    - Contact info tự động lấy từ user nếu không có trong body
- `GET /bookings/:id/fare-details` - Lấy thông tin chi tiết fare đã chọn
  - **Response**: `{ bookingId, pnrCode, fareClassName, descriptions[], priceOneWay, totalPassengers, totalPrice }`
- `PATCH /bookings/:id/passengers` - Cập nhật số lượng người
  - **Body**: `{ adults, minors }`
  - **Response**: `{ success, message, totalPassengers }`
- `GET /bookings/:id/payment-info` - Lấy thông tin thanh toán
  - **Response**: `{ bookingId, pnrCode, totalAmount, currencyCode, contactFullname, contactEmail, contactPhone, status }`
  - **Response**:
    ```json
    {
      "deals": [
        {
          "image": "/images/routes/019a8f4a-bb0e-7402-a0c4-27647b89dc71.jpg",
          "title": "Tp. Hồ Chí Minh (SGN) đến Hà Nội (HAN)",
          "link": "/service/019a8f4a-bb0e-7402-a0c4-27647b89dc71",
          "startDate": "02/03/2026",
          "endDate": "",
          "tripType": "one_way",
          "service": "Dịch vụ bay thẳng",
          "price": "962,000 VND"
        },
        {
          "image": "/images/routes/019a8f4a-bb0e-7402-a0c4-27647b89dc71.jpg",
          "title": "Tp. Hồ Chí Minh (SGN) đến Hà Nội (HAN)",
          "link": "/service/019a8f4a-bb0e-7402-a0c4-27647b89dc71",
          "startDate": "02/03/2026",
          "endDate": "09/03/2026",
          "tripType": "round_trip",
          "service": "Dịch vụ bay khứ hồi",
          "price": "1,924,000 VND"
        }
      ]
    }
    ```
  - **Lưu ý**: 
    - API này cần Services Microservice chạy (port 4002)
    - Hỗ trợ cả **one-way** và **round-trip** deals
    - `tripType`: `"one_way"` hoặc `"round_trip"`
    - `endDate`: Rỗng cho one-way, có giá trị cho round-trip
    - `service`: "Dịch vụ bay thẳng" (one-way) hoặc "Dịch vụ bay khứ hồi" (round-trip)
    - `price`: Với round-trip, giá là tổng của cả 2 chuyến
    - `image`: Format `/images/routes/{route_id}.jpg` (route_id là UUID v7 - 36 ký tự)
      - Ảnh được lưu tại `public/images/routes/{route_id}.jpg`
      - Được serve tự động qua static files middleware
      - Nếu chưa có trong database, service tự động generate URL theo format trên
      - **Script download**: `npm run download:deals-images` để tự động tải ảnh từ Lorem Picsum
    - `link`: Format `/service/{route_id}` (route_id là UUID v7 - 36 ký tự)
    - Dữ liệu được lấy từ database (bảng Routes: `image_url`, `service_link`)
    - **Xem thêm**: `docs/setup/DEALS_IMAGES_SETUP.md` - Hướng dẫn setup và quản lý ảnh deals

### User
- `GET /users` - Lấy thông tin user (cần JWT token)

## Response Format

### Success (200)
```json
{
  "tripType": "...",
  "outbound": [...],
  ...
}
```

### Error (400, 404, 500)
```json
{
  "statusCode": 400,
  "message": ["validation error 1", "validation error 2"],
  "error": "Bad Request"
}
```

## Authentication

### Header
```
Authorization: Bearer <access_token>
```

### Token Flow
1. FE gọi `/auth/login` hoặc `/auth/register`
2. Backend trả về `access_token` và `refresh_token`
3. FE lưu tokens (localStorage/sessionStorage)
4. FE gửi `access_token` trong header cho các request cần auth
5. Khi `access_token` hết hạn, FE gọi `/auth/refresh` với `refresh_token`

### APIs yêu cầu Authentication
- `POST /bookings` - Tạo booking (yêu cầu JWT)
- `GET /users` - Lấy thông tin user (yêu cầu JWT)
- Các APIs khác có thể yêu cầu authentication tùy vào implementation

## Development Commands

```bash
# Start API Gateway (port 3000)
npm run start:dev

# Start Search Microservice (port 4001) - Cần chạy song song với API Gateway
npm run start:search:dev

# Start Services Microservice (port 4002) - Cần chạy nếu dùng API /services/deals
npm run start:services:dev

# Start Routes Microservice (port 4003) - Cần chạy nếu dùng API /routes/upload-image
npm run start:routes:dev

# Start Booking Microservice (port 4004) - Cần chạy nếu dùng booking APIs
npm run start:booking:dev

# Start Reservation Microservice (port 4005) - Cần chạy nếu dùng reservation APIs
npm run start:reservation:dev

# Start Payment Microservice (port 4006) - Cần chạy nếu dùng payment APIs
npm run start:payment:dev

# Start Email Microservice (port 4007) - Cần chạy nếu dùng email APIs
npm run start:email:dev

# Start Redis (port 6379) - Required cho Reservation Service
docker-compose up -d redis

# Seed database với dữ liệu nội địa (HAN, SGN, DAD)
npm run seed:domestic

# Test database connection
npm run test:db

# Test email service
npm run test:email
```

## Environment Variables

```env
# Database
DB_TYPE=mssql
DB_HOST=localhost
DB_PORT=1434
DB_USER=...
DB_PASS=...
DB_NAME=flight_booking_db
DB_ENCRYPT=false              # Azure thì true
DB_TRUST_CERT=true            # local dev hay dùng true

# API Gateway
PORT=3000

# Token
JWT_ACCESS_SECRET=c769850ee4f001088ba440c3211390099dbb7f9e2e0593be9233e395dce6e931
JWT_ACCESS_EXPIRES='15m'
JWT_REFRESH_SECRET=1bbf355aefde63bd595ec266351544354991b215124ed1b88ab7c8ef92f876d8
JWT_REFRESH_EXPIRES=7d

# Search Microservice
SEARCH_MS_HOST=127.0.0.1
SEARCH_MS_PORT=4001

# Services Microservice
SERVICES_MS_HOST=127.0.0.1
SERVICES_MS_PORT=4002

# Routes Microservice
ROUTES_MS_HOST=127.0.0.1
ROUTES_MS_PORT=4003

# Booking Microservice
BOOKING_MS_HOST=127.0.0.1
BOOKING_MS_PORT=4004

# Reservation Microservice
RESERVATION_MS_HOST=127.0.0.1
RESERVATION_MS_PORT=4005

# Payment Microservice
PAYMENT_MS_HOST=127.0.0.1
PAYMENT_MS_PORT=4006

# Email Microservice
EMAIL_MS_HOST=127.0.0.1
EMAIL_MS_PORT=4007

# Gmail API Configuration
GMAIL_CREDENTIALS_PATH=./credentials_desktop_apps.json
GMAIL_TOKEN_PATH=./token.json
GMAIL_FROM_EMAIL=me
EMAIL_MAX_RETRIES=3

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_KEY_PREFIX=flight-booking:
REDIS_RESERVATION_TTL=900  # 15 minutes (in seconds)
```

## Lưu ý cho FE

1. **API Gateway là entry point duy nhất**: Tất cả requests từ FE đều gọi đến port 3000
2. **Swagger UI**: Xem chi tiết API tại `http://localhost:3000/api-docs`
3. **Search API**: Cần cả API Gateway và Search Microservice đều chạy
4. **Services API**: Cần cả API Gateway và Services Microservice đều chạy (nếu dùng `/services/deals`)
5. **Round trip**: 
   - Nếu `tripType=round_trip` thì bắt buộc phải có `returnDate`
   - `tripType` là optional: Nếu không truyền, sẽ tự động set dựa trên `returnDate` (có `returnDate` → `round_trip`, không có → `one_way`)
6. **Error handling**: Check `statusCode` trong response để handle errors
7. **UUID v7**: Tất cả IDs trong hệ thống (flightInstanceId, bookingId, userId...) sử dụng **UUID v7** (time-ordered UUID). Format: `xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx`. UUID v7 có thể sắp xếp theo thời gian, tốt cho database indexing.
8. **Payment Service Features (Phase 1 & 2 - Production Ready)**:
   - Idempotency (Hybrid Approach): Prevent duplicate payments với idempotency key
     - Redis Cache: Fast path (~1ms) - check Redis first với TTL 2 hours
     - DB Fallback: Guarantee path (~20-50ms) - fallback to DB nếu Redis miss/fail
     - Performance: ~95% latency reduction (1-2ms average vs 20-50ms DB-only)
     - Safety: Redis failures không block payment creation, always fallback to DB
     - Configuration: `REDIS_IDEMPOTENCY_TTL=7200`, `REDIS_IDEMPOTENCY_ENABLED=true`
   - Amount Validation: Payment amount phải bằng booking total amount
   - Concurrency Control: Database lock để prevent concurrent payments
   - Payment Gateway Integration: Ready structure để tích hợp VNPay, MoMo, Stripe
   - Webhook Handling: Endpoint `/payments/webhooks/:gateway` để nhận webhook từ payment gateway
   - Payment Expiration: Payment tự động expire sau 15 phút
   - Payment Method Availability: Check payment method is active
   - Payment Notifications: Tự động gửi notification khi payment success/failed
9. **Email Service Features**:
   - Gmail API Integration: OAuth 2.0 authentication với Gmail API
   - Email Queue Management: In-memory queue với async processing
   - Retry Logic: Max 3 retries với exponential backoff
   - Rate Limiting: 100 emails/phút (configurable)
   - Email Templates: 5 templates sẵn có (OTP payment, OTP password reset, payment success/failed, booking confirmation)
   - Health Check: Endpoint `/emails/health` để monitor service
   - Configuration: `GMAIL_CREDENTIALS_PATH`, `GMAIL_TOKEN_PATH`, `GMAIL_FROM_EMAIL`, `EMAIL_MAX_RETRIES`
9. **Booking API Features**:
   - Yêu cầu JWT authentication - `userId` tự động extract từ token
   - Contact info tự động lấy từ user nếu không có trong body
   - Hỗ trợ tạo passenger mới trong booking request (không cần tạo trước)
   - Passenger tự động link với user để tái sử dụng sau này
   - Tự động detect và reuse passenger nếu cùng `documentNumber` đã tồn tại
9. **Pricing Strategy**: 
   - Services API sử dụng historical pricing (từ BookingSegments) - tính giá trung bình
   - Nếu không có booking data, route sẽ bị bỏ qua (không hiển thị trong deals)
   - Giá được format theo chuẩn Việt Nam: "962,000 VND"
10. **Routes Schema**:
   - Bảng Routes có thêm 2 columns: `image_url` và `service_link`
   - Format chuẩn:
     - `image_url`: `/images/routes/{route_id}.jpg` (route_id là UUID v7, length = 55)
     - `service_link`: `/service/{route_id}` (route_id là UUID v7, length = 45)
   - Có CHECK constraints và trigger tự động generate nếu NULL hoặc không đúng format
11. **Static Files & Images**:
   - **Public Folder**: `public/` - Thư mục chứa static files được serve tự động
   - **Images Folder**: `public/images/routes/` - Chứa ảnh phong cảnh cho deals API
   - **Format**: `{route_id}.jpg` (route_id là UUID v7 - 36 ký tự)
   - **Kích thước**: 1920x1080 (16:9) - landscape images
   - **Static Files Middleware**: NestJS serve static files từ `public/` folder tại root path `/`
   - **URL Access**: `{{base_url}}/images/routes/{route_id}.jpg`
   - **Auto Download Script**: `npm run download:deals-images` - Tự động download ảnh từ Lorem Picsum cho tất cả routes
   - **Xem thêm**: `docs/setup/DEALS_IMAGES_SETUP.md` - Hướng dẫn chi tiết
