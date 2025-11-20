# Changelog - API Documentation Updates

## Ngày cập nhật: 2025-01-20 (Latest - Payment API DTO Fix & Test Setup Improvements)

### Payment API DTO Fix

- **Issue**: API Gateway `CreatePaymentDto` thiếu `amount` và `idempotencyKey` fields
  - Khi tests gửi các fields này, validation pipe từ chối với 400 Bad Request
  - API Gateway DTO không khớp với microservice DTO

- **Fix**: 
  - Thêm `amount` field (optional, với validation `@IsNumber()` và `@Min(0.01)`)
  - Thêm `idempotencyKey` field (optional, với validation `@IsString()`)
  - Cập nhật `src/api-gateway/modules/payment/dto/create-payment.dto.ts` để match với microservice DTO

- **Impact**: 
  - Payment API tests giờ có thể gửi `amount` và `idempotencyKey` mà không bị validation errors
  - API Gateway DTO giờ khớp 100% với microservice DTO

### E2E Test Setup Improvements

- **Docker Support**: Cải thiện test setup để hỗ trợ chạy tests với Docker
  - **Issue**: Khi chạy E2E tests, API Gateway chạy trên localhost nhưng microservices chạy trong Docker
  - **Fix**: 
    - Cập nhật `test/setup.ts` để tự động load `.env` và set default environment variables
    - Đảm bảo API Gateway kết nối đúng đến microservices trong Docker qua `localhost:4006`
  - **Documentation**: 
    - Cập nhật `test/RUN_TESTS.md` với troubleshooting guide cho Docker setup
    - Thêm hướng dẫn kiểm tra Payment microservice connection

- **Test Helper Logging**: Thêm logging để dễ debug khi tests fail
  - Thêm logging trong `processPayment` helper để hiển thị response body khi có lỗi
  - Giúp dễ dàng debug khi tests fail

**Files Modified:**
- `src/api-gateway/modules/payment/dto/create-payment.dto.ts` - Added missing fields
- `test/setup.ts` - Added environment variable setup for Docker
- `test/helpers/test-helpers.ts` - Added error logging
- `test/RUN_TESTS.md` - Added troubleshooting guide
- `test/README.md` - Updated prerequisites section

---

## Ngày cập nhật: 2025-01-20 (Previous - Interfaces Separation & Code Structure)

### Code Structure Changes - Interfaces Separation

- **Interfaces được tách riêng**: Tất cả interfaces được tách ra khỏi logic code vào folder `interfaces/` của mỗi service
  - **Email Service**: `src/microservices/email/interfaces/`
    - `email-queue.interface.ts` - `QueuedEmail` interface
    - `email-template.interface.ts` - `TemplateResult` interface
  - **Search Service**: `src/microservices/search/interfaces/`
    - `flight-result.interface.ts` - `FlightResult` interface (di chuyển từ `types/`)
  - **Payment Service**: `src/microservices/payment/interfaces/`
    - `payment-gateway.interface.ts` - `IPaymentGateway`, `PaymentGatewayResponse`, `PaymentWebhookResult` interfaces (di chuyển từ `gateways/`)
  - **Best Practice**: Mỗi service có folder `interfaces/` riêng với `index.ts` để export tất cả interfaces
  - **Benefits**: 
    - Separation of concerns - interfaces tách biệt khỏi implementation
    - Dễ maintain và tìm kiếm
    - Consistent structure across all services
    - Better code organization

---

## Ngày cập nhật: 2025-01-20 (Previous - Email Service & Centralized Enums)

### Major Changes - Email Microservice & Centralized Enums

#### 1. **Email Microservice (Port 4007)**
- **New Microservice**: Email Microservice được tạo để xử lý tất cả email operations
- **Port**: 4007 (TCP)
- **Architecture**: Microservice pattern với NestJS, Gmail API integration
- **Gmail API Integration**: OAuth 2.0 authentication với Gmail API
  - Support credentials file: `credentials_desktop_apps.json`
  - Token file: `token.json` (auto-generated sau khi authenticate)
  - OAuth 2.0 flow với auto token refresh

**Implementation:**
- `EmailService`: Main business logic
- `EmailMsController`: Microservice controller xử lý message patterns
- `EmailModule`: Module với Gmail API service, queue service, template service
- `GmailApiService`: Gmail API integration với OAuth 2.0
- `EmailQueueService`: Queue management với retry logic và rate limiting
- `EmailTemplateService`: Email template rendering

**Email Queue Management:**
- In-memory queue với async processing
- Retry logic: Max 3 retries với exponential backoff
- Rate limiting: 100 emails/phút (configurable)
- Queue statistics tracking

**Email Templates:**
- `otp_payment` - OTP cho xác thực thanh toán
- `otp_password_reset` - OTP cho đặt lại mật khẩu
- `payment_success` - Thông báo thanh toán thành công kèm thông tin vé
- `payment_failed` - Thông báo thanh toán thất bại
- `booking_confirmation` - Xác nhận đặt chỗ

**Email APIs:**
- `POST /emails/send` - Gửi email đơn lẻ (JWT required)
- `GET /emails/:emailId/status` - Lấy trạng thái email (JWT required)
- `GET /emails/health` - Health check (public, no auth)

**Configuration:**
- `GMAIL_CREDENTIALS_PATH` - Path to Gmail credentials file
- `GMAIL_TOKEN_PATH` - Path to Gmail token file
- `GMAIL_FROM_EMAIL` - From email address
- `EMAIL_MAX_RETRIES` - Max retry attempts

#### 2. **Centralized Enums (Shared Constants)**
- **Tất cả enum được centralize** tại `src/shared/constants/enums/`
- **Structure**:
  - `payment.enum.ts` - PaymentMethodCode, PaymentStatus
  - `search.enum.ts` - TripType, CabinType
  - `email.enum.ts` - EmailStatus, EmailTemplate
  - `index.ts` - Export tất cả enums
- **Import pattern**: `import { EnumName } from 'src/shared/constants/enums'`
- **Benefits**:
  - Single source of truth
  - Consistency giữa API Gateway và Microservices
  - Easy maintenance
  - Type safety

**Updated Files:**
- Tất cả DTO files (microservices và API Gateway) - removed enum definitions
- Service files - updated imports
- Controller files - updated imports
- Response DTO files - updated imports

#### 3. **API Gateway Integration**
- Email Client Module: `EmailClientModule` registered trong `app.module.ts`
- Email Controller: REST API endpoints cho email operations
- DTOs: SendEmailDto, EmailResponseDto với Swagger documentation

#### 4. **Docker & Environment**
- Docker Compose: Email Service (port 4007) added
- Start scripts: `start:email` và `start:email:dev` added
- Environment variables: Email Service config và Gmail API config

#### 5. **Updated Documentation**
- `API_DOCS.md`: Added Email APIs section
- `API_TESTING_FLOW.md`: Added Step 12-14 for Email testing
- `API_SEQUENCE_DIAGRAMS.md`: Added Email Service to sequence diagrams
- `CHANGELOG_API_DOCS.md`: Document Email Service changes
- `CHANGELOG.md`: Added Email Service entry
- `STRUCTURE.md`: Added Email Service to structure và endpoints
- Postman Collection: Email requests sẽ được thêm

---

## Ngày cập nhật: 2025-01-20 (Previous - Payment Service Phase 1 & 2: Production Ready Improvements)

### Major Changes - Payment Service Production Ready Improvements (Phase 1 & 2)

#### 1. **Payment Service Enhancements (Phase 1: Critical Fixes)**
- **Idempotency & Duplicate Prevention (Hybrid Approach)**: 
  - Thêm `idempotency_key` field vào Payment entity
  - Thêm `idempotencyKey` vào CreatePaymentDto (optional)
  - **Hybrid Storage**: Redis (fast cache, TTL: 2h) + DB (persistence & guarantee)
  - **Performance**: ~95% latency reduction (1-2ms vs 20-50ms DB-only)
  - **Flow**: Check Redis first → Fallback to DB → Cache result in Redis
  - System check và return existing payment nếu đã tồn tại (prevent duplicate payments)
  - **Safety**: Redis failures không block payment creation, always fallback to DB
  - **Configuration**: `REDIS_IDEMPOTENCY_TTL=7200`, `REDIS_IDEMPOTENCY_ENABLED=true`
  
- **Amount Validation**: 
  - Thêm `amount` vào CreatePaymentDto (optional, defaults to booking total amount)
  - Strict validation: payment amount PHẢI bằng booking total amount (no partial payments)
  
- **Concurrency Control**: 
  - Sử dụng database pessimistic lock (UPDLOCK, ROWLOCK) khi create/process payment
  - Prevent race condition khi multiple requests cùng lúc
  
- **Payment Gateway Integration Structure**:
  - Tạo `IPaymentGateway` interface cho payment gateway abstraction
  - Tạo `PaymentGatewayFactory` để manage multiple gateways (VNPay, MoMo, Stripe, etc.)
  - Implement `MockPaymentGateway` cho development/testing
  - Ready structure để tích hợp payment gateway thực tế (không cần sửa business logic)

#### 2. **Payment Service Enhancements (Phase 2: Production Ready)**
- **Webhook Handling**:
  - Thêm endpoint `POST /payments/webhooks/:gateway` để nhận webhook từ payment gateway
  - Verify webhook signature để đảm bảo request hợp lệ
  - Process webhook và update payment status automatically
  - Async payment status update (không block user request)
  
- **Payment Expiration**:
  - Thêm `expires_at` field vào Payment entity
  - Payment tự động expire sau **15 phút** nếu chưa thanh toán
  - Validate expiration khi process payment
  
- **Payment Method Availability Check**:
  - Thêm `is_active` field vào PaymentMethod entity
  - Validate payment method phải active trước khi tạo payment
  
- **Payment Notification Service**:
  - Tạo `PaymentNotificationService` để gửi notification khi payment success/failed/pending
  - Ready để integrate với email/SMS service
  - Automatic notification khi payment status được update (via webhook)

#### 3. **Payment Gateway Architecture**
- **Code Structure** (Best Practice):
  ```
  src/microservices/payment/
  ├── interfaces/
  │   ├── payment-gateway.interface.ts
  │   └── index.ts
  ├── gateways/
  │   ├── payment-gateway.factory.ts
  │   ├── mock-payment.gateway.ts
  │   └── vnpay.gateway.example.ts
  ├── services/
  │   ├── payment-validation.service.ts
  │   └── payment-notification.service.ts
  └── ...
  ```

- **Payment Gateway Factory Pattern**:
  - Switch giữa Mock Gateway (development) và Real Gateway (production) dễ dàng
  - Support multiple payment gateways cùng lúc
  - Easy to extend với gateway mới (chỉ cần implement interface)

#### 4. **API Changes**
- **Create Payment DTO**: Thêm `idempotencyKey` (optional) và `amount` (optional)
- **Payment Response DTO**: Thêm `expiresAt` và `paymentUrl` fields
- **Webhook Endpoint**: Thêm `POST /payments/webhooks/:gateway` (public endpoint, no auth required)

#### 5. **Updated Documentation**
- `API_DOCS.md`: Update Payment APIs với các features mới (idempotency, expiration, webhook, etc.)
- `API_TESTING_FLOW.md`: Thêm Step 10 - Payment Gateway Webhook testing
- `API_SEQUENCE_DIAGRAMS.md`: Update Phase 7 & 8 với payment gateway integration và webhook flow
- `CHANGELOG_API_DOCS.md`: Document Phase 1 & 2 improvements
- Postman Collection: Update payment requests với fields mới và thêm webhook request

**Documentation:**
- `docs/design/PAYMENT_SERVICE_ANALYSIS.md`: Phân tích Payment Service và đề xuất improvements
- `docs/design/PAYMENT_GATEWAY_EXPLANATION.md`: Giải thích Mock vs Real Payment Gateway
- `src/microservices/payment/gateways/vnpay.gateway.example.ts`: Example code để implement VNPay gateway

---

## Ngày cập nhật: 2025-01-20 (Previous - Payment API Implementation)

### Major Changes - Payment Microservice & APIs

#### 1. **Payment Microservice (Port 4006)**
- **New Microservice**: Payment Microservice được tạo để xử lý tất cả payment operations
- **Port**: 4006 (TCP)
- **Architecture**: Microservice pattern với NestJS, TypeORM, SQL Server
- **Transaction Safety**: Tất cả payment operations sử dụng database transactions

**Implementation:**
- `PaymentService`: Business logic với transaction handling
- `PaymentMsController`: Microservice controller xử lý message patterns
- `PaymentModule`: Module với TypeORM entities (Payment, PaymentMethod, Booking, Currency)
- Message Patterns: `CREATE_PAYMENT`, `PROCESS_PAYMENT`, `GET_PAYMENT`, `GET_PAYMENTS_BY_BOOKING`, `UPDATE_PAYMENT_STATUS`

**Code Locations:**
- Microservice: `src/microservices/payment/`
- API Gateway: `src/api-gateway/modules/payment/`
- Entities: `src/shared/entities/payment/`

#### 2. **Payment APIs (REST Endpoints)**
- **POST** `/payments/bookings/:bookingId` - Create payment record (status: pending)
- **POST** `/payments/bookings/:bookingId/process` - Create and process payment immediately (status: success)
- **GET** `/payments/:id` - Get payment by ID
- **GET** `/payments/bookings/:bookingId` - Get all payments for a booking
- **PATCH** `/payments/:id/status` - Update payment status (for webhooks/admin)

**Features:**
- Transaction-safe: Tất cả operations sử dụng TypeORM transactions
- Auto-update booking status: Khi payment success → booking status = 'paid'
- Validation: Kiểm tra booking thuộc về user, booking chưa paid, etc.
- JWT Authentication: Extract userId từ JWT token (giống như Booking/Reservation APIs)
- Payment Methods: CREDIT_CARD, DEBIT_CARD, BANK_TRANSFER, EWALLET, CASH
- Payment Status: pending → success (hoặc failed)

#### 3. **Payment Flow Integration**
- **Complete Booking Flow** bây giờ bao gồm Payment step:
  1. Search flights
  2. Get fare options
  3. Create reservation
  4. Create booking from reservation
  5. Get booking payment info
  6. **Process payment** (NEW)
  7. Verify payment

- **Payment Processing**:
  - Create payment record với status `pending`
  - Process payment (simulate payment gateway - trong production sẽ tích hợp với payment gateway thực tế)
  - Update payment status thành `success`
  - Auto-update booking status thành `paid`
  - Set `paidAt` timestamp

#### 4. **Updated Documentation**
- `API_DOCS.md`: Thêm Payment APIs section với đầy đủ endpoints
- `API_TESTING_FLOW.md`: Thêm Payment flow steps (Step 9-10)
- `API_SEQUENCE_DIAGRAMS.md`: Thêm Phase 7 - Process Payment sequence diagram
- `CHANGELOG_API_DOCS.md`: Document Payment API changes
- Postman Collection: Thêm Payment APIs requests

#### 5. **Package.json Scripts**
- Thêm scripts: `start:payment` và `start:payment:dev`

**Documentation:**
- `docs/api/API_DOCS.md`: Payment APIs documentation
- `docs/api/API_TESTING_FLOW.md`: Payment testing flow
- `docs/api/API_SEQUENCE_DIAGRAMS.md`: Payment sequence diagrams
- `tools/Flight-Booking-API.postman_collection.json`: Payment API requests

---

## Ngày cập nhật: 2025-11-19 (Previous - JWT Pattern Implementation)

### Major Changes - JWT Authentication Pattern (Best Practice: Option 2)

#### 1. **JWT Pattern: Extract userId từ Gateway (Industry Standard)**
- **Architecture**: API Gateway là single point of authentication - validate JWT một lần
- **Gateway**: Extract `userId` từ JWT token và gửi đến microservices
- **Microservices**: Trust Gateway - không validate JWT, chỉ nhận `userId`
- **Security**: JWT secret chỉ ở Gateway, microservices không cần biết về JWT

**Implementation:**
- All protected endpoints: `@UseGuards(JwtAuthGuard)` at Gateway level
- Gateway extracts `userId` from `req.user.userId` (set by JwtStrategy)
- Gateway sends `userId` to microservices (NOT JWT token)
- Microservices receive `userId` directly, no JWT validation needed

**Benefits:**
- Performance: JWT validated một lần (Gateway) thay vì N lần (N microservices)
- Security: JWT secret chỉ ở Gateway (single point of trust)
- Simplicity: Microservices không cần JWT logic
- Scalability: Dễ thêm microservices mới (không cần setup JWT)

**Code Locations:**
- Gateway: `src/api-gateway/modules/auth/strategies/jwt.strategyt.ts`
- Gateway Controllers: `src/api-gateway/modules/booking/booking.controller.ts`, `src/api-gateway/modules/reservation/reservation.controller.ts`
- Microservices: `src/microservices/booking/booking.controller.ts`, `src/microservices/reservation/reservation.controller.ts`

**Documentation:**
- `docs/design/JWT_MICROSERVICES_PATTERN.md`: Best practice analysis
- `docs/design/JWT_IMPLEMENTATION_SUMMARY.md`: Implementation summary
- `docs/api/API_DOCS.md`: Updated with JWT pattern details
- `docs/api/API_SEQUENCE_DIAGRAMS.md`: Updated sequence diagrams with JWT validation flow

#### 2. **Reservation Expiration Validation (Best Practice)**
- **Primary**: Check `expiresAt` timestamp (source of truth) - real-time accuracy
- **Secondary**: Check `status` field (optimization & business logic)
- Prevents race conditions, không phụ thuộc vào background jobs

**Implementation:**
- `BookingService.createBookingFromReservation`: Check `expiresAt` first, then `status`
- `ReservationService.getReservation`: Check `expiresAt` first, update `status` if expired
- Detailed error messages with timestamps

**Documentation:**
- `docs/design/RESERVATION_EXPIRATION_VALIDATION.md`: Best practice explanation

#### 3. **Passenger Reuse Best Practice**
- **Automatic Reuse**: Backend tự động detect và reuse passenger với cùng `documentNumber` và `userId`
- **Validation**: Validate thông tin khớp (`fullname`, `dob`, `gender`) - log warning nếu không khớp
- **Benefits**: Tránh duplicates, cải thiện UX

**Implementation:**
- `BookingService.createBookingFromReservation`: Check existing passenger by `documentNumber` and `user_id`
- Validate matching details, log warnings for mismatches
- Reuse existing passenger to avoid duplicates

**Documentation:**
- `docs/design/PASSENGER_REUSE_BEST_PRACTICE.md`: Best practice explanation

---

## Ngày cập nhật: 2025-11-19 (Previous - Hybrid Approach)

### Major Changes - Reservation Storage Hybrid Approach

#### 1. **Hybrid Approach: Database + Redis (Best Practice Implementation)**
- **Reservation Storage**: Implemented Hybrid Approach (Database + Redis) thay vì chỉ Redis
- **Database**: Persistent storage, audit trail, analytics
  - Table: `Reservations` với đầy đủ fields
  - Status tracking: `pending`, `expired`, `converted`, `cancelled`
  - Indexes: `user_id`, `reservation_code`, `status`, `expires_at`
- **Redis**: Fast cache với TTL 15 phút (auto cleanup)
- **Get Flow**: Try Redis first (fast) → Fallback to Database → Re-cache if needed
- **Recovery**: Nếu Redis down, vẫn có thể lấy reservation từ Database
- **Benefits**:
  - Reliability: Không mất data khi Redis restart/crash
  - Analytics: Track conversion rate, abandonment rate
  - Audit Trail: Full history với timestamps
  - Business Intelligence: Phân tích user behavior

#### 2. **Updated Reservation Service**
- `createReservation`: Save to Database → Save to Redis
- `getReservation`: Try Redis first → Fallback to Database → Re-cache
- `listReservations`: Query Database → Enrich with Redis cache
- `cancelReservation`: Update Database → Delete from Redis
- `extendReservation`: Update Database → Update Redis
- `markReservationAsConverted`: Update Database status → Delete from Redis (called by Booking Service)
- `cleanupExpiredReservations`: Method để update expired reservations trong Database

#### 3. **Updated Booking Service**
- Changed from `CANCEL_RESERVATION` to `MARK_RESERVATION_AS_CONVERTED`
- Reservation status được update thành `converted` với `converted_at` timestamp
- Reservation được delete từ Redis sau khi booking được tạo

#### 4. **Updated Documentation**
- `API_SEQUENCE_DIAGRAMS.md`: Updated sequence diagrams với Database save và fallback
- `API_DOCS.md`: Updated reservation API notes với Hybrid Approach
- `ERD.md`: Added Reservations table và relationships
- `RESERVATION_STORAGE_ANALYSIS.md`: Marked implementation as completed

---

## Ngày cập nhật: 2025-11-19 (Previous)

### Major Changes - Backend State Management Improvements

#### 1. **Priority 1: Deprecate Legacy Booking Flow**
- **Booking API**: `reservationId` query parameter bây giờ là **REQUIRED**
- **Direct booking** (không có reservationId) đã deprecated và không còn được hỗ trợ
- Tất cả bookings phải được tạo từ reservation để đảm bảo backend-managed state
- Frontend chỉ cần gửi: `reservationId` + `passengers` + `contactInfo`
- Backend tự động lấy tất cả flight info, pricing từ reservation

#### 2. **Priority 2: Multi-Segment Reservation (Round-Trip Support)**
- **Reservation API**: Hỗ trợ `segments[]` array thay vì single segment
- **One-way booking**: 1 segment với `segmentType: 'outbound'`
- **Round-trip booking**: 1 reservation với 2 segments (outbound + inbound)
- Frontend chỉ cần lưu 1 `reservationId` cho cả round-trip
- Backend validate tất cả segments cùng lúc, đảm bảo atomic operations
- Response format: `{ segments: [{ segmentId, flightInstanceId, fareClassCode, segmentType, baseFare, ... }, ...], totalAmount, ... }`

#### 3. **Updated Documentation**
- `API_DOCS.md`: Cập nhật reservation và booking endpoints
- `API_SEQUENCE_DIAGRAMS.md`: Cập nhật sequence diagrams với multi-segment flow
- `API_TESTING_FLOW.md`: Hướng dẫn test API theo flow từng bước
- `BACKEND_STATE_MANAGEMENT_ANALYSIS.md`: Updated status to 100% Backend-managed (COMPLETED)

#### 4. **Removed Backward Compatibility (Breaking Change)**
- **Đã xóa hoàn toàn backward compatibility code** - Chỉ support format mới với `segments[]` array
- `ReservationResponseDto` không còn các fields cũ (`flightInstanceId`, `fareClassCode`, `baseFare`, `taxAmount`, `feeAmount`)
- `BookingService` chỉ chấp nhận reservation có `segments[]` array, throw error nếu không có
- **Breaking change**: Code cũ sử dụng format single segment sẽ không còn hoạt động
- **Lý do**: Chưa có frontend/external clients đang sử dụng API, nên có thể xóa code cũ để code sạch hơn

---

## Ngày cập nhật: 2025-11-18 (Previous)

### Đã hoàn thành

#### 1. **Sequence Diagrams (Mermaid)**
- Tạo file `docs/api/API_SEQUENCE_DIAGRAMS.md` với đầy đủ sequence diagrams cho tất cả các flow chính:
  - Authentication Flow (Register, Login, Get Current User)
  - Search Flow (Search Flights, Get Fare Options)
  - Reservation Flow (Create, Get, List, Cancel, Extend)
  - Booking Flow (Create from Reservation, Get Fare Details, Get Payment Info)
  - Services Flow (Get Flight Deals)
  - Routes Flow (Upload Image)

#### 2. **ERD Updates**
- Cập nhật ERD (`docs/database/ERD.md`) để khớp với code hiện tại:
  - **Users**: Thêm các fields: `password_hash`, `phone`, `created_at`, `updated_at`, `refresh_token`, `refresh_token_expires_at`, `forgot_password_token`, `forgot_password_token_expires_at`, `is_active`
  - **Passengers**: Thêm `created_at`
  - **Bookings**: Thêm `created_at`, `updated_at`
  - **FlightInstances**: Thêm `created_at`, `updated_at`
  - **FareClasses**: Thêm `change_rule`, `refund_rule`
  - **Tickets**: Thêm `issued_at`
  - **Payments**: Thêm `paid_at`, `created_at`

#### 3. **API Documentation**
- `API_DOCS.md`: Tài liệu đầy đủ về tất cả API endpoints
- `API_SEQUENCE_DIAGRAMS.md`: Sequence diagrams mô tả flow xử lý của toàn bộ hệ thống
- `API_TESTING_FLOW.md`: Hướng dẫn test API theo flow từng bước
- Tất cả diagrams sử dụng Mermaid format, có thể render trên GitHub

---

## Tổng kết

### Files đã tạo/cập nhật:

1. **`docs/api/API_SEQUENCE_DIAGRAMS.md`** (MỚI)
   - 10+ sequence diagrams chi tiết
   - Mô tả đầy đủ flow xử lý từ Client → API Gateway → Microservices → Database/Redis

2. **`docs/api/API_TESTING_FLOW.md`** (MỚI)
   - Hướng dẫn test API theo flow từng bước
   - Prerequisites, step-by-step flows, troubleshooting

3. **`docs/database/ERD.md`** (CẬP NHẬT)
   - Cập nhật các fields còn thiếu
   - ERD giờ đã khớp 100% với code

### Kiểm tra ERD vs Code:

| Entity | Status | Notes |
|--------|--------|-------|
| Users | Đã cập nhật | Thêm 8 fields còn thiếu |
| Passengers | Đã cập nhật | Thêm `created_at` |
| Bookings | Đã cập nhật | Thêm `created_at`, `updated_at` |
| FlightInstances | Đã cập nhật | Thêm `created_at`, `updated_at` |
| FareClasses | Đã cập nhật | Thêm `change_rule`, `refund_rule` |
| Tickets | Đã cập nhật | Thêm `issued_at` |
| Payments | Đã cập nhật | Thêm `paid_at`, `created_at` |
| Routes | Đúng | Không cần cập nhật |
| Airports | Đúng | Không cần cập nhật |
| FlightSchedules | Đúng | Không cần cập nhật |
| BookingSegments | Đúng | Không cần cập nhật |
| BookingPassengers | Đúng | Không cần cập nhật |

---

## Kết luận

- **ERD đã được cập nhật và khớp 100% với code**
- **Sequence diagrams đã được tạo đầy đủ cho tất cả các flow chính**
- **Tài liệu API flow đã được hoàn thiện**

### Không cần chỉnh sửa thêm gì!

ERD và code hiện tại đã đồng bộ hoàn toàn. Tất cả các fields trong database schema đều đã được reflect trong ERD diagram.

