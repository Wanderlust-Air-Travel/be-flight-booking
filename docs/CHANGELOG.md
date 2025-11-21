# Changelog

Tất cả các thay đổi quan trọng của project sẽ được ghi nhận trong file này.

## [Unreleased]

### Added

- **Seat Selection Feature**: Tích hợp tính năng chọn ghế ngồi vào reservation và booking flow
  - **New API**: `GET /search/seats` - Lấy bản đồ ghế ngồi cho flight instance và cabin type
    - Trả về danh sách ghế với thông tin: `flightSeatId`, `seatNumber`, `seatType`, `position`, `isAvailable`, `isExitRow`, `cabinClassCode`
    - Hỗ trợ filter theo cabin type (economy/business)
  - **Reservation API Enhancement**: 
    - Thêm `flightSeatId` (optional) vào `CreateReservationSegmentDto`
    - Response bao gồm `flightSeatId` và `seatNumber` trong mỗi segment
    - Ghế được giữ (hold) khi tạo reservation và giải phóng tự động nếu reservation cancel/expire
  - **Booking API Enhancement**:
    - Ghế đã chọn trong reservation được tự động assign vào booking khi tạo booking từ reservation
    - `BookingSegment` entity liên kết với `FlightSeat` entity
  - **Seat Availability Management**:
    - Ghế được mark là `is_available = false` khi được reserve
    - Ghế được giải phóng (`is_available = true`) khi reservation cancel hoặc expire
    - Validation: Kiểm tra ghế tồn tại, available, thuộc về flight instance và cabin class đúng
  - **Test Coverage**: 
    - 7 test cases cho Search API seat map (happy & unhappy cases)
    - 5 test cases cho Reservation API với seat selection (happy & unhappy cases)
    - 2 test cases cho Booking API với seat assignment
  - **Files Modified**:
    - `src/microservices/search/` - Added `getSeatMap` method và DTOs
    - `src/api-gateway/modules/search/` - Added `GET /search/seats` endpoint
    - `src/microservices/reservation/` - Enhanced reservation creation với seat validation và hold logic
    - `src/microservices/booking/` - Enhanced booking creation với seat assignment
    - `test/api/search.e2e-spec.ts` - Added seat map tests
    - `test/api/reservation.e2e-spec.ts` - Added seat selection tests
    - `test/api/booking.e2e-spec.ts` - Added seat assignment tests
    - `test/helpers/test-helpers.ts` - Added `getSeatMap` helper function
  - **Best Practices**:
    - Sử dụng database field naming conventions (snake_case)
    - Seat selection là optional - user có thể tạo reservation mà không chọn ghế
    - Atomic seat hold/release operations
    - Proper error handling và validation
    - Consistent với existing microservice architecture

### Fixed

- **Payment API DTO Mismatch**: Fixed API Gateway `CreatePaymentDto` thiếu `amount` và `idempotencyKey` fields
  - **Issue**: API Gateway DTO không khớp với microservice DTO, dẫn đến validation errors (400 Bad Request) khi tests gửi các fields này
  - **Fix**: 
    - Thêm `amount` field (optional, với validation `@IsNumber()` và `@Min(0.01)`)
    - Thêm `idempotencyKey` field (optional, với validation `@IsString()`)
    - Cập nhật `src/api-gateway/modules/payment/dto/create-payment.dto.ts` để match với microservice DTO
  - **Impact**: Payment API tests giờ có thể gửi `amount` và `idempotencyKey` mà không bị validation errors

- **E2E Test Setup for Docker**: Cải thiện test setup để hỗ trợ chạy tests với Docker
  - **Issue**: Khi chạy E2E tests, API Gateway chạy trên localhost nhưng microservices chạy trong Docker, cần cấu hình environment variables đúng
  - **Fix**: 
    - Cập nhật `test/setup.ts` để tự động load `.env` và set default environment variables cho tất cả microservices
    - Đảm bảo API Gateway kết nối đúng đến microservices trong Docker qua `localhost:4006` (vì Docker đã expose ports)
  - **Files Modified**: 
    - `test/setup.ts` - Added environment variable setup for Docker
    - `test/RUN_TESTS.md` - Added troubleshooting guide for Docker setup
  - **Impact**: Tests có thể chạy với Docker mà không cần manual configuration

- **Test Helper Logging**: Thêm logging để dễ debug khi tests fail
  - **Issue**: Khi tests fail, khó debug vì không thấy response body
  - **Fix**: 
    - Thêm logging trong `processPayment` helper để hiển thị response body khi có lỗi
    - Giúp dễ dàng debug khi tests fail
  - **Files Modified**: 
    - `test/helpers/test-helpers.ts` - Added error logging

### Changed

- **Code Structure - Interfaces Separation**: Tất cả interfaces được tách riêng ra khỏi logic code
  - **Email Service**: Interfaces được tách vào `src/microservices/email/interfaces/`
    - `email-queue.interface.ts` - `QueuedEmail` interface
    - `email-template.interface.ts` - `TemplateResult` interface
  - **Search Service**: Interfaces được tách vào `src/microservices/search/interfaces/`
    - `flight-result.interface.ts` - `FlightResult` interface (di chuyển từ `types/`)
  - **Payment Service**: Interfaces được tách vào `src/microservices/payment/interfaces/`
    - `payment-gateway.interface.ts` - `IPaymentGateway`, `PaymentGatewayResponse`, `PaymentWebhookResult` interfaces (di chuyển từ `gateways/`)
  - **Best Practice**: Mỗi service có folder `interfaces/` riêng với `index.ts` để export tất cả interfaces
  - **Benefits**: 
    - Separation of concerns - interfaces tách biệt khỏi implementation
    - Dễ maintain và tìm kiếm
    - Consistent structure across all services
    - Better code organization

### Added

- **Email Microservice** (port 4007): Microservice mới xử lý email logic với Gmail API integration
  - Entry point: `src/microservices/email/main.email.ts`
  - Chạy bằng: `npm run start:email` hoặc `npm run start:email:dev`
  - Environment variables: `EMAIL_MS_HOST`, `EMAIL_MS_PORT`
  - **Email Service Features**:
    - **Gmail API Integration**: Tích hợp Gmail API với OAuth 2.0
      - OAuth 2.0 authentication flow
      - Token management và auto-refresh
      - Support credentials file: `credentials_desktop_apps.json`
      - Token file: `token.json` (auto-generated sau khi authenticate)
    - **Email Queue Management**: In-memory queue với async processing
      - Queue emails và xử lý background
      - Retry logic: Max 3 retries với exponential backoff
      - Rate limiting: 100 emails/phút (configurable)
      - Queue statistics tracking
    - **Email Templates**: 5 templates sẵn có
      - `otp_payment` - OTP cho xác thực thanh toán
      - `otp_password_reset` - OTP cho đặt lại mật khẩu
      - `payment_success` - Thông báo thanh toán thành công kèm thông tin vé
      - `payment_failed` - Thông báo thanh toán thất bại
      - `booking_confirmation` - Xác nhận đặt chỗ
    - **Async Processing**: Background queue processing không block requests
    - **Health Check**: Endpoint để monitor service health và queue stats
  - **Email APIs**:
    - `POST /emails/send` - Gửi email đơn lẻ (JWT required)
    - `GET /emails/:emailId/status` - Lấy trạng thái email (JWT required)
    - `GET /emails/health` - Health check (public, no auth)
  - **Configuration**:
    - `GMAIL_CREDENTIALS_PATH` - Path to Gmail credentials file (default: `./credentials_desktop_apps.json`)
    - `GMAIL_TOKEN_PATH` - Path to Gmail token file (default: `./token.json`)
    - `GMAIL_FROM_EMAIL` - From email address (default: `me`)
    - `EMAIL_MAX_RETRIES` - Max retry attempts (default: 3)
  - **Docker**: Email Service (port 4007) đã được thêm vào docker-compose-full-services.yml và start-all.ts
  - **Shared Enums**: Tất cả enum được centralize tại `src/shared/constants/enums/`
    - `PaymentMethodCode`, `PaymentStatus` - Payment enums
    - `TripType`, `CabinType` - Search enums
    - `EmailStatus`, `EmailTemplate` - Email enums
    - Import từ: `import { EnumName } from 'src/shared/constants/enums'`

- **Payment Microservice** (port 4006): Microservice mới xử lý payment logic (Production Ready - Phase 1 & 2)
  - Entry point: `src/microservices/payment/main.payment.ts`
  - Chạy bằng: `npm run start:payment` hoặc `npm run start:payment:dev`
  - Environment variables: `PAYMENT_MS_HOST`, `PAYMENT_MS_PORT`
  - **Payment Service Features (Phase 1 & 2)**:
    - **Idempotency (Hybrid Approach)**: Prevent duplicate payments với idempotency key
      - **Redis Cache**: Fast path (~1ms) - check Redis first với TTL 2 hours
      - **DB Fallback**: Guarantee path (~20-50ms) - fallback to DB nếu Redis miss/fail
      - **Performance**: ~95% latency reduction (1-2ms average vs 20-50ms DB-only)
      - **Safety**: Redis failures không block payment creation, always fallback to DB
      - **Audit Trail**: DB lưu vĩnh viễn cho compliance và reconciliation
    - **Amount Validation**: Payment amount phải bằng booking total amount (strict validation)
    - **Concurrency Control**: Database lock (pessimistic) để prevent concurrent payments
    - **Payment Gateway Integration**: Ready structure để tích hợp VNPay, MoMo, Stripe, etc.
    - **Webhook Handling**: Endpoint `/payments/webhooks/:gateway` để nhận webhook từ payment gateway
    - **Payment Expiration**: Payment tự động expire sau 15 phút
    - **Payment Method Availability**: Check payment method is active (`is_active = true`)
    - **Payment Notifications**: Tự động gửi notification khi payment success/failed
  - **Payment APIs**:
    - `POST /payments/bookings/:bookingId` - Tạo payment record (status: pending)
    - `POST /payments/bookings/:bookingId/process` - Tạo và integrate với payment gateway
    - `GET /payments/:id` - Lấy payment details
    - `GET /payments/bookings/:bookingId` - Lấy tất cả payments của booking
    - `PATCH /payments/:id/status` - Update payment status
    - `POST /payments/webhooks/:gateway` - Handle webhook từ payment gateway (public endpoint, no auth)
  - **Database Changes**:
    - Payments table: thêm `idempotency_key VARCHAR(100) NULL`, `expires_at DATETIME2 NULL`
    - PaymentMethods table: thêm `is_active BIT NOT NULL DEFAULT 1`
    - Indexes: `IX_Payments_IdempotencyKey`, `IX_Payments_ExpiresAt`
  - **Migration**: `1734600000000-UpdatePaymentTables.ts` - Migration để add các fields mới
  - **Payment Gateway Architecture**:
    - `IPaymentGateway` interface cho payment gateway abstraction (trong `interfaces/payment-gateway.interface.ts`)
    - `PaymentGatewayFactory` để manage multiple gateways
    - `MockPaymentGateway` cho development/testing
    - Ready structure để tích hợp real payment gateways (VNPay, MoMo, Stripe)
  - **Docker**: Payment Service (port 4006) đã được thêm vào docker-compose-full-services.yml và start-all.ts
  - **Idempotency Key Storage (Hybrid Approach)**:
    - Implement Hybrid Approach: Redis (fast cache) + DB (persistence & guarantee)
    - **Redis Service**: Sử dụng shared Redis service (đã có từ Reservation Service)
    - **Configuration**: `REDIS_IDEMPOTENCY_TTL=7200` (2 hours), `REDIS_IDEMPOTENCY_ENABLED=true`
    - **Flow**: Check Redis first → Fallback to DB → Cache result in Redis
    - **Performance**: ~95% latency reduction (1-2ms vs 20-50ms)
    - **Safety**: Graceful degradation - Redis failures không affect payment creation
    - **Documentation**: 
      - `docs/design/IDEMPOTENCY_KEY_STORAGE_ANALYSIS.md` - Analysis & comparison
      - `docs/design/IDEMPOTENCY_IMPLEMENTATION.md` - Implementation details

### Added

- **Reservation Microservice** (port 4005): Microservice mới xử lý reservation logic với Redis
  - Entry point: `src/microservices/reservation/main.reservation.ts`
  - Chạy bằng: `npm run start:reservation` hoặc `npm run start:reservation:dev`
  - Environment variables: `RESERVATION_MS_HOST`, `RESERVATION_MS_PORT`
  - **Sử dụng Hybrid Approach (Database + Redis)** để lưu reservation state
    - Database: Persistent storage, audit trail, analytics
    - Redis: Fast cache với TTL 15 phút
  - Reservation tự động expire sau 15 phút (configurable)
  - **Reservation APIs**:
    - `POST /reservations` - Tạo reservation, lưu vào Redis
    - `GET /reservations` - List tất cả active reservations của user hiện tại
    - `GET /reservations/:id` - Lấy reservation theo ID hoặc code (auto-detect)
    - `GET /reservations/code/:code` - Lấy reservation theo code
    - `POST /reservations/:id/cancel` - Hủy reservation
    - `POST /reservations/:id/extend` - Gia hạn reservation TTL
  - **Redis Setup**: Cần chạy Redis với Docker (`docker-compose up -d redis`)
  - **Redis Config**: `REDIS_HOST`, `REDIS_PORT`, `REDIS_RESERVATION_TTL` (default: 900 seconds)

- **Booking Microservice** (port 4004): Microservice mới xử lý booking logic
  - Entry point: `src/microservices/booking/main.booking.ts`
  - Chạy bằng: `npm run start:booking` hoặc `npm run start:booking:dev`
  - Environment variables: `BOOKING_MS_HOST`, `BOOKING_MS_PORT`

- **Booking APIs**:
  - `POST /bookings` - Tạo booking mới với passengers và segments
    - **NEW**: Hỗ trợ `?reservationId=xxx` query parameter để tạo booking từ reservation (recommended flow)
    - Tự động generate PNR code (6 ký tự alphanumeric, unique)
    - Transaction-safe với rollback support
    - Response: `{ bookingId, pnrCode, totalAmount, currencyCode, status }`
    - **Auto-cancel reservation**: Tự động cancel reservation sau khi tạo booking thành công
  - `GET /bookings/:id/fare-details` - Lấy thông tin chi tiết fare đã chọn
    - Bao gồm descriptions với status (true/false) cho mỗi điều kiện
    - Response: `{ bookingId, pnrCode, fareClassName, descriptions[], priceOneWay, totalPassengers, totalPrice }`
  - `PATCH /bookings/:id/passengers` - Cập nhật số lượng người (adults/minors)
    - Response: `{ success, message, totalPassengers }`
  - `GET /bookings/:id/payment-info` - Lấy thông tin thanh toán
    - Response: `{ bookingId, pnrCode, totalAmount, currencyCode, contactFullname, contactEmail, contactPhone, status }`

- **API mới**: `POST /routes/:routeId/upload-image` - Upload hình ảnh cho route
  - File: JPG/JPEG/PNG, max 5MB
  - Auth: JWT required
  - Response: `{ imageUrl: "/images/routes/{route_id}.jpg", message: "..." }`
  - Cần Routes Microservice chạy (port 4003): `npm run start:routes:dev`

- **API mới**: `GET /services/deals` - Lấy danh sách flight deals
  - Response: `{ deals: [{ image, title, link, startDate, endDate, tripType, service, price }] }`
  - Hỗ trợ cả one-way và round-trip deals
  - Cần Services Microservice chạy (port 4002): `npm run start:services:dev`

- **Database**: Bảng Routes thêm `image_url` và `service_link`
  - Format: `/images/routes/{route_id}.jpg` và `/service/{route_id}`
  - `route_id` là UUID v7 (36 ký tự)

### Changed

- **Booking Flow - Backend-managed State với Reservation**: Flow booking đã được cải thiện với Reservation Service
  - **NEW FLOW**: Search → Fare Options → **Create Reservation** → Create Booking from Reservation
  - **Backend-managed State**: Backend lưu `flightInstanceId` và `fareClassCode` trong Redis thay vì frontend
  - **Reservation Service**: Tách thành microservice riêng (port 4005) - chuẩn microservice architecture
  - **Redis-based**: Reservation lưu trong Redis với TTL tự động expire (không cần database table)
  - **Benefits**: 
    - Đảm bảo tính nhất quán (backend quản lý state)
    - Tránh race condition (lock seats tạm thời)
    - Tự động cleanup (Redis TTL)
    - Không cần migration database

- **Booking API - JWT Authentication & Passenger Creation**: API `POST /bookings` giờ yêu cầu JWT authentication và hỗ trợ tạo passenger mới
  - **BREAKING CHANGE**: `userId` không cần truyền trong request body nữa - sẽ được tự động lấy từ JWT token
  - **BREAKING CHANGE**: `contactFullname`, `contactEmail`, `contactPhone` giờ là optional - nếu không truyền, sẽ tự động lấy từ thông tin user trong database
  - **MAJOR IMPROVEMENT**: `passengerId` giờ là optional - nếu không có, có thể tạo passenger mới từ thông tin trong request
  - **Passenger Creation Logic**:
    - Nếu có `passengerId` → sử dụng passenger đã có
    - Nếu không có `passengerId` → tự động tạo passenger mới từ `fullname`, `dob`, `gender`, `documentNumber`
    - Passenger mới được link với user (từ JWT) để tái sử dụng sau này
    - Tự động detect và reuse passenger nếu cùng `documentNumber` đã tồn tại cho user
  - API giờ yêu cầu JWT Bearer Token trong header: `Authorization: Bearer <access_token>`
  - Cải thiện UX: User không cần tạo passenger trước, có thể nhập thông tin trực tiếp khi đặt vé

- **User Registration**: Đăng ký user giờ tự động generate `user_id` là **UUID v7** thay vì để SQL Server tự generate bằng `NEWSEQUENTIALID()`
  - Tất cả user IDs được tạo từ API `/auth/register` đều là UUID v7 format
  - UUID v7 format: `xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx` (chữ số `7` ở vị trí version)
  - Đảm bảo consistency với seed script và các APIs khác yêu cầu UUID v7

- **Fare Options API**: `/search/fare-options` response format đã được cải thiện
  - **BREAKING CHANGE**: Response format đã thay đổi từ object sang array trực tiếp
  - Response format mới: Array trực tiếp `[{ fareClassCode, name, typeTicket, price, availableSeats, desc, ... }]`
  - **Đã bỏ**: Group wrapper với hardcode `id: 1, code: 1` (không phù hợp với UUID v7 system)
  - Mỗi fare option có thêm `typeTicket` field (tên hiển thị)
  - Mỗi fare option có `desc` array chứa các mô tả chi tiết với `text` và `status` (true/false)
  - `desc` bao gồm: baggage rules, refund rules, change rules, loyalty points, seat selection, etc.
  - Format này đơn giản hơn, phù hợp với UUID v7 system và dễ sử dụng cho FE

- **CORS**: Đã bật CORS cho API Gateway (port 3000) để frontend có thể gọi API
  - Cho phép tất cả origins trong dev mode (hoặc set `FRONTEND_URL` trong `.env` để giới hạn)
  - Hỗ trợ credentials (cookies, authorization headers)
  - Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
- **Payment Flow**: Complete booking flow bây giờ bao gồm Payment step
  - Flow: Search → Fare Options → Create Reservation → Create Booking → **Process Payment** → Payment Gateway Webhook (Async) → Verify Payment
  - Payment sẽ tự động update booking status thành `paid` khi payment thành công (via webhook)
  - Payment tự động expire sau 15 phút nếu chưa thanh toán
  - System tự động gửi notification khi payment success/failed
- **Idempotency Key Storage**: Chuyển từ DB-only sang **Hybrid Approach** (Redis + DB)
  - **Performance Improvement**: ~95% latency reduction (1-2ms vs 20-50ms)
  - **Redis Caching**: Idempotency keys cached trong Redis với TTL 2 hours
  - **DB Persistence**: Vẫn lưu trong DB để audit trail và guarantee
  - **Fallback Strategy**: Redis failures → DB fallback (không mất guarantee)
  - **Feature Flag**: Có thể disable Redis qua `REDIS_IDEMPOTENCY_ENABLED=false`
- **Services API**: `/services/deals` giờ hỗ trợ cả one-way và round-trip deals
  - Thêm field `tripType`: `"one_way"` hoặc `"round_trip"`
  - Round-trip: `endDate` có giá trị, `service` = "Dịch vụ bay khứ hồi", `price` = tổng giá 2 chuyến
  - One-way: `endDate` = "", `service` = "Dịch vụ bay thẳng"
- **Pricing**: Chỉ dùng historical pricing (average từ BookingSegments), bỏ fallback
- **Image/Link format**: Dùng UUID v7 thay vì số tự tăng

### Notes for Frontend

- **CORS**: API Gateway đã bật CORS, frontend có thể gọi API từ bất kỳ origin nào (dev mode)
- **Booking Flow (Mới với Reservation)**: 
  1. Search flights → `GET /search/flights`
  2. Chọn flight → Get fare options → `GET /search/fare-options` (response: array trực tiếp `[{ fareClassCode, name, typeTicket, price, desc, ... }]`)
  3. Chọn fare class → **Create reservation** → `POST /reservations` (yêu cầu JWT authentication)
     - Backend lưu state vào Redis
     - Response: `{ reservationId, reservationCode, totalAmount, expiresAt, ... }`
  4. Điền thông tin passenger → Create booking → `POST /bookings?reservationId=xxx` (yêu cầu JWT authentication)
     - Backend lấy thông tin từ reservation (không cần frontend gửi lại)
  5. Xem fare details → `GET /bookings/:id/fare-details`
  6. Update passengers (nếu cần) → `PATCH /bookings/:id/passengers`
  7. Get payment info → `GET /bookings/:id/payment-info`
- **Booking API Important Notes**:
  - Yêu cầu JWT Bearer Token: `Authorization: Bearer <access_token>`
  - `userId` không cần truyền - tự động extract từ JWT token
  - Contact info (`contactFullname`, `contactEmail`, `contactPhone`) là optional - tự động lấy từ user nếu không có
  - `passengerId` là optional - có thể tạo passenger mới từ thông tin trong request
  - Passenger mới tự động link với user để tái sử dụng sau này
- **Fare Options Response**: Array trực tiếp của fare options, mỗi option có `desc` array với `text` và `status` (true/false)
  - **Lưu ý**: Đã bỏ group wrapper `{ id, type, code, list }` để tránh hardcode số và phù hợp với UUID v7 system
- Routes API cần Routes Microservice (port 4003)
- Services API cần Services Microservice (port 4002)
- Booking APIs cần Booking Microservice (port 4004)
- **Reservation APIs cần Reservation Microservice (port 4005) và Redis**
- **Payment APIs cần Payment Microservice (port 4006)**
  - Chạy Reservation Microservice: `npm run start:reservation:dev`
  - Chạy Redis: `docker-compose up -d redis`
  - Reservation được lưu trong Redis với TTL 15 phút (tự động expire)
  - **Không cần database table** - Reservation chỉ là temporary state
- Image URLs: `/images/routes/{uuid-v7}.jpg`
- Service links: `/service/{uuid-v7}`
- Pricing: Average từ bookings, format "962,000 VND"
- Deals API: Mỗi route có thể có cả one-way và round-trip deals (nếu có return route)
- **User Registration**: User ID được tự động generate là **UUID v7** format

---

## [Previous Versions]

*Các version trước không có changelog chi tiết*

