# Changelog - API Documentation Updates

## Ngày cập nhật: 2025-01-20 (Latest - Payment API Implementation)

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

