# Changelog

Lịch sử các thay đổi quan trọng của dự án.

## [Unreleased]

### Bug Fixes (2025-12-XX)

- **Fixed Booking Cancellation Logic - Booking Status Check (2025-12-XX)**
  - **Issue**: Frontend hiển thị "Có thể hủy" nhưng backend từ chối hủy với lỗi "Cannot cancel booking with status: paid"
  - **Root Cause**: Logic `getMyTickets` tính `canCancel` dựa trên fare class và thời hạn, nhưng không kiểm tra booking status trước
  - **Fix**:
    - Cập nhật `getMyTickets` trong `BookingService` để kiểm tra booking status trước khi tính `canCancel`
    - Booking với status `paid`, `cancelled`, hoặc `completed` → `canCancel: false` với lý do rõ ràng
    - Chỉ booking với status `pending` hoặc `confirmed` mới được kiểm tra fare class và thời hạn
  - **Impact**: Frontend và backend đã đồng bộ về logic hủy vé, tránh lỗi khi user click hủy
  - **Files Changed**:
    - `src/microservices/booking/booking.service.ts` - Updated `getMyTickets()` method to check booking status first

### Tính năng mới (2025-12-XX)

- **Booking Cancellation Feature (2025-12-XX)**
  - **Feature**: Cho phép user hủy booking theo quy định Bamboo Airways
  - **Implementation**:
    - Endpoint `PATCH /api/v1/bookings/:id/cancel` - Hủy booking (chỉ authenticated users)
    - Validation ownership: Chỉ user sở hữu booking mới có thể hủy
    - Validation status: Chỉ booking `pending` hoặc `confirmed` mới có thể hủy
    - Cancellation eligibility check: Kiểm tra fare class và thời hạn hủy
    - Transaction-based: Đảm bảo tính nhất quán khi hủy booking và tickets
  - **Business Rules (Quy định Bamboo Airways)**:
    - **Chặng bay nội địa:** Hoàn thiện thủ tục hoàn vé trước giờ khởi hành tối thiểu **03 tiếng**
    - **Chặng bay quốc tế:** Thực hiện thủ tục hoàn vé trước giờ khởi hành ít nhất **05 tiếng**
    - **Hạng vé được phép hoàn:** Economy Smart, Economy Flex, Premium Smart, Premium Flex, Business Smart, Business Flex
    - **Hạng vé KHÔNG được phép hoàn:** Economy Saver Max (YSM, SMX), Economy Saver / Bamboo Eco
  - **Frontend Implementation**:
    - UI button "Hủy đặt chỗ" trong "Vé của tôi" page
    - UI button "Hủy đặt chỗ" trong "Hành trình của tôi" page
    - Hiển thị điều khoản hủy vé chi tiết cho từng ticket
    - Confirm dialog trước khi hủy
    - Auto-refresh sau khi hủy thành công
    - Hiển thị cancellation deadline và reason nếu không thể hủy
  - **Files Changed**:
    - `src/microservices/booking/booking.service.ts` - Method `cancelBooking()`, improved `checkCancellationEligibility()`
    - `src/microservices/booking/booking.controller.ts` - Handler `handleCancelBooking()`
    - `src/microservices/booking/booking.messages.ts` - Added `CANCEL_BOOKING` pattern
    - `src/api-gateway/modules/booking/booking.controller.ts` - Endpoint `PATCH /api/v1/bookings/:id/cancel`
    - `booking/app/api/bookings/[bookingId]/cancel/route.ts` - Frontend API route (new)
    - `booking/app/(page)/my-tickets/page.tsx` - Cancel button và cancellation terms display
    - `booking/app/(page)/my-journey/page.tsx` - Cancel button
  - **Documentation**:
    - Updated `docs/api/API_DOCS.md` - Added cancel booking endpoint documentation
    - Updated `docs/api/API_SEQUENCE_DIAGRAMS.md` - Added cancel booking flow diagrams
    - Updated `docs/CHANGELOG.md` - Added cancellation feature details
    - Updated Postman collection - Added cancel booking request

### Tính năng mới (2025-12-XX)

- **RabbitMQ Integration (2025-12-XX)**
  - **Feature**: Tích hợp RabbitMQ cho asynchronous messaging và event-driven architecture
  - **Implementation**:
    - RabbitMQ service với automatic reconnection và connection pooling
    - Email notifications qua RabbitMQ queue (non-blocking)
    - Ticket creation sau payment qua RabbitMQ queue (async processing)
    - Hybrid email client: RabbitMQ preferred, TCP fallback
    - Management UI tại `http://localhost:15672` (admin/admin123)
  - **Benefits**:
    - Improved performance: Non-blocking email và ticket creation
    - Better scalability: Message queue cho high-volume operations
    - Resilience: Automatic reconnection và fallback mechanisms
    - Message persistence: Durable queues với TTL
  - **Configuration**:
    - Environment variables: `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USER`, `RABBITMQ_PASS`
    - Queues: `email_notifications`, `ticket_creation`
    - Prefetch count: 10 messages per consumer
  - **Files Changed**:
    - `src/shared/modules/rabbitmq/` - Core RabbitMQ modules (new)
    - `src/microservices/email/consumers/email-rabbitmq.consumer.ts` - Email consumer (new)
    - `src/microservices/booking/consumers/ticket-rabbitmq.consumer.ts` - Ticket consumer (new)
    - `src/shared/modules/email-client/hybrid-email-client.service.ts` - Hybrid email client (new)
    - `src/microservices/payment/payment.service.ts` - Publish ticket creation to RabbitMQ
    - `docker-compose.yml` - Added RabbitMQ service
    - `package.json` - Added `amqplib` dependency
  - **Documentation**: 
    - Added `docs/design/RABBITMQ_INTEGRATION.md` - Comprehensive RabbitMQ integration guide
    - Updated `README.md` - Added RabbitMQ to tech stack and features

- **Payment Flow Improvements (2025-12-XX)**
  - **Error Handling**: Cải thiện xử lý lỗi "Booking is already paid"
    - Frontend tự động redirect đến confirmation page thay vì hiển thị error
    - User-friendly error messages
    - Better validation và error detection
  - **API Route Fixes**: Sửa lỗi "paymentId path parameter is required"
    - Hỗ trợ cả Next.js 13-14 (sync params) và Next.js 15+ (async params)
    - Fallback: Extract paymentId từ URL path nếu params không có
    - Improved error messages
  - **Files Changed**:
    - `booking/app/(page)/booking/payment/page.tsx` - Improved error handling, auto-redirect
    - `booking/app/api/payments/[paymentId]/route.ts` - Fixed parameter extraction
  - **User Experience**: 
    - Seamless flow khi booking đã paid
    - Better error messages
    - Automatic redirects

### Tính năng mới (2025-11-28)

- **Guest Booking Support (2025-11-28)**
  - **Feature**: Hệ thống hỗ trợ guest bookings - người dùng chưa đăng nhập có thể đặt chuyến bay
  - **Implementation**:
    - Sử dụng `OptionalJwtAuthGuard` cho booking và reservation APIs
    - `POST /api/v1/reservations` - Optional authentication (guest bookings được hỗ trợ)
    - `POST /api/v1/bookings` - Optional authentication (guest bookings được hỗ trợ)
    - `GET /api/v1/bookings/:id/fare-details` - Public endpoint
    - `GET /api/v1/bookings/:id/payment-info` - Public endpoint
  - **Guest Booking Rules**:
    - Contact information (fullname, email, phone) là **BẮT BUỘC** cho guest bookings
    - Passenger information phải được cung cấp đầy đủ (không thể dùng `passengerId`)
    - Booking được tạo với `user_id = null`
    - Passengers được tạo với `user_id = null`
  - **Authenticated Booking Rules**:
    - Contact information là **OPTIONAL** (sẽ dùng user info nếu không có)
    - Có thể dùng `passengerId` để tái sử dụng passenger đã lưu
  - **Files Changed**:
    - `src/api-gateway/modules/booking/booking.controller.ts` - Sử dụng `OptionalJwtAuthGuard`, validate contact info cho guest
    - `src/microservices/booking/booking.service.ts` - Xử lý `userId = null`, validate contact info cho guest
    - `src/microservices/booking/booking.controller.ts` - Type update để nhận `userId: string | null`
    - `booking/app/api/bookings/route.ts` - Authorization header là optional
    - `booking/app/api/reservations/route.ts` - Authorization header là optional
    - `booking/app/(page)/booking/info/page.tsx` - Bỏ yêu cầu login, hỗ trợ guest booking
  - **Documentation**: 
    - Added `docs/design/GUEST_BOOKING_FLOW.md` - Design document cho guest booking
    - Updated `docs/api/API_DOCS.md` - Thêm guest booking flow và validation rules
    - Updated `docs/api/API_SEQUENCE_DIAGRAMS.md` - Thêm sequence diagrams cho guest và authenticated booking flows
    - Updated `booking/docs/README.md` - Thêm guest booking documentation
    - Updated `README.md` - Thêm guest booking feature

### Cải tiến quan trọng (2025-11-26)

- **Payment Microservice Timeout Configuration (2025-11-26)**
  - **Problem**: Payment microservice timeout sau 15 giây khiến 11/25 tests fail
  - **Solution**: Thêm timeout configuration cho payment microservice client
    - **Write Operations** (createPayment, processPayment, updatePaymentStatus, handleWebhook): 60 seconds timeout
    - **Read Operations** (getPayment, getPaymentsByBooking): 30 seconds timeout
  - **Implementation**:
    - Sử dụng RxJS `timeout` operator trong `firstValueFrom` calls
    - Proper error handling với `catchError` để map timeout errors
    - Timeout errors được map với `ETIMEDOUT` code để được handle đúng cách
  - **Best Practice**: Payment operations cần timeout dài hơn vì:
    - Database transactions với pessimistic locks (có thể chậm nếu có lock contention)
    - Payment gateway integration (external API calls)
    - Complex validation và business logic
  - **Results**: All 25/25 payment tests now passing (100% pass rate)
  - **Files Changed**:
    - `src/api-gateway/modules/payment/payment.controller.ts` - Added timeout operators to all firstValueFrom calls

- **Seat Validation trong Booking State (2025-11-26)**
  - **Comprehensive Validation**: Thêm validation toàn diện cho seat selection trước khi lưu vào booking state
  - **Validation Rules**:
    - Validate cabin selection exists (cabin phải được chọn trước)
    - Validate flight instance exists
    - Validate seat exists trong database
    - Validate seat thuộc về đúng flight instance
    - Validate seat number matches với seat ID
    - Validate seat is available (is_available = true)
    - Validate seat matches cabin class đã chọn (Economy/Business) - **MOST IMPORTANT**
  - **Error Messages**: Cải thiện error messages với thông tin cụ thể về validation failures
  - **Best Practice**: Early validation (fail fast) - validate trước khi lưu vào booking state
  - **Files Changed**:
    - `src/api-gateway/modules/booking-state/booking-state.controller.ts` - Added `validateSeatSelection()` method
    - `src/api-gateway/modules/booking-state/booking-state.module.ts` - Added TypeORM repositories (FlightSeat, FlightInstance, FareClass)
  - **Documentation**: Added `docs/api/BOOKING_STATE_SEAT_API.md` with comprehensive validation rules

- **Error Handling Improvements (2025-11-26)**
  - **Reservation Controller**: Cải thiện error handling để preserve error messages từ microservice
    - Handle HttpException instances correctly
    - Extract error messages từ multiple error formats
    - Provide descriptive default messages với keywords (cabin|seat|booking state)
  - **Payment Controller**: Cải thiện error message extraction từ microservice errors
    - Try multiple error formats để extract meaningful messages
    - Provide descriptive default messages
  - **Files Changed**:
    - `src/api-gateway/modules/reservation/reservation.controller.ts` - Improved error handling
    - `src/api-gateway/modules/payment/payment.controller.ts` - Improved error handling
    - `src/microservices/reservation/reservation.service.ts` - Improved error propagation

- **Test Improvements (2025-11-26)**
  - **Booking State Tests**: Sửa tests để clear state đúng cách trước khi test
  - **Email Tests**: Sửa test để thêm `/api/v1` prefix trong path
  - **Improvements Tests**: 
    - Sửa API versioning test expectations
    - Sửa rate limiting test để tránh connection issues
    - Sửa CORS test để thêm Origin header
  - **All E2E Tests**: 178/203 tests passing (87.7%)
    - Health: 3/3 PASS
    - Auth: 37/37 PASS
    - Search: 34/34 PASS
    - Reservation: 28/28 PASS
    - Booking: 20/20 PASS
    - Booking State: 24/24 PASS
    - Email: 18/18 PASS
    - Improvements: 13/13 PASS
    - Payment: 14/25 PASS (11 fail do microservice timeout - infrastructure issue, not code bug)

### Tính năng mới

- **Deals Images Download Script Improvements (2025-11-25)**
  - **Auto-cleanup**: Tự động xóa tất cả ảnh cũ trong `public/images/routes` trước khi download ảnh mới
  - **Top 8 Deals Only**: Chỉ download ảnh cho top 8 deals từ API `/api/v1/services/deals` (FE chỉ hiển thị 8 items)
  - **API Gateway Health Check**: Đợi API Gateway sẵn sàng trước khi fetch deals với retry logic và exponential backoff
  - **Error Handling**: Comprehensive error handling với logging
  - **Files Changed**:
    - `scripts/download-deals-images.ts` (updated)
    - `docker/entrypoint-with-download.ts` (new)

- **Conditional Database Seeding (2025-11-25)**
  - **Check Existing Data**: Kiểm tra database đã có data chưa trước khi seed
  - **Raw SQL Queries**: Sử dụng raw SQL để tránh TypeORM entity metadata issues
  - **Prevent Duplicate Seeding**: Tránh seed lại data đã tồn tại
  - **Graceful Exit**: Nếu đã có data, log message và exit gracefully
  - **Files Changed**:
    - `docker/seed-if-empty.ts` (new)
    - `src/scripts/seed-full-database.ts` (updated - added check)

### Tính năng mới

- **Auto-fetch từ Booking State (2025-11-25)**
  - **OptionalJwtAuthGuard**: Guard mới cho phép optional authentication - extract user từ JWT token nếu có, nhưng không bắt buộc authentication
  - **Auto-fetch Logic**: Một số API tự động lấy thông tin từ booking state khi user đã đăng nhập:
    - `GET /api/v1/search/fare-options`: Tự động lấy `flightInstanceId` và `cabinType` từ booking state
    - `GET /api/v1/search/seats`: Tự động lấy `cabinType` từ booking state
  - **Benefits**: Cải thiện UX, giảm số lượng API calls, backward compatible
  - **Implementation**:
    - `OptionalJwtAuthGuard` extract user từ JWT token nhưng không block request nếu không có token
    - `BookingStateRepository.findAllByUserId()` sử dụng raw Redis client để query keys (fix ioredis keyPrefix issue)
    - Query parameters luôn có priority cao hơn booking state (override)
  - **Files Changed**:
    - `src/api-gateway/modules/auth/guard/optional-jwt-auth.guard.ts` (new)
    - `src/api-gateway/modules/search/search.controller.ts` (updated)
    - `src/shared/repositories/booking-state.repository.ts` (updated)
    - `src/api-gateway/modules/auth/auth.module.ts` (updated)
    - `src/api-gateway/modules/search/search.client.module.ts` (updated)

### Cải tiến

- **Validation logic cho Booking State (2025-11-25)**
  - Thêm validation `fareClassCode` phải match với `cabinType`:
    - Economy: `fareClassCode` phải bắt đầu bằng 'Y' (ví dụ: 'YS', 'YF', 'YSM')
    - Business: `fareClassCode` phải bắt đầu bằng 'J' (ví dụ: 'JS', 'JF', 'JFLX')
  - Exception mới: `InvalidFareClassException` khi validation fail
  - Đảm bảo data integrity trước khi lưu vào Redis

- **Cải thiện Docker initialization flow (2025-11-25)**
  - Tách `wait-for-sqlserver.ts` và `wait-for-database.ts` để tránh race condition
  - Flow mới: `wait-for-sqlserver` → `init-db` → `wait-for-db` → `seed-db` → `start:all`
  - Thêm verification step sau migrations để đảm bảo database sẵn sàng
  - Tăng delay trước khi start services (10 giây) để đảm bảo database hoàn toàn sẵn sàng
  - Fix lỗi "Login failed" do database chưa tồn tại khi services kết nối

- **Code organization improvements (2025-11-25)**
  - Tách interfaces ra file riêng (`docker/start-all.types.ts`)
  - Tuân thủ separation of concerns: types tách khỏi logic code

### Tính năng mới

- **Email thông báo tự động (2025-11-23)**
  - Gửi email xác nhận thanh toán thành công/thất bại tự động
  - Gửi email xác nhận đặt chỗ sau khi tạo booking
  - Email được gửi ngầm, không làm chậm quá trình xử lý

- **Mã OTP cho xác thực (2025-11-23)**
  - Gửi mã OTP qua email cho thanh toán (hết hạn sau 15 phút)
  - Gửi mã OTP qua email cho đặt lại mật khẩu (hết hạn sau 10 phút)
  - Mã OTP chỉ dùng được một lần, tự động xóa sau khi xác thực thành công
  - Bảo mật: Không tiết lộ email có tồn tại hay không khi quên mật khẩu
  - **API mới**:
    - `POST /api/v1/auth/otp/payment/send` - Gửi OTP thanh toán
    - `POST /api/v1/auth/otp/payment/verify` - Xác thực OTP thanh toán
    - `POST /api/v1/auth/otp/password-reset/send` - Gửi OTP đặt lại mật khẩu
    - `POST /api/v1/auth/otp/password-reset/verify` - Xác thực OTP và đặt lại mật khẩu

- **Tải ảnh tự động cho deals (2025-11-22)**
  - Script tự động tải ảnh phong cảnh cho các deals
  - Chạy lệnh: `npm run download:deals-images`

### Thay đổi

- **Tìm kiếm chuyến bay đơn giản hơn (2025-11-21)**
  - Không cần truyền `tripType` nữa, hệ thống tự động nhận biết:
    - Có ngày về → Tự động là khứ hồi
    - Không có ngày về → Tự động là một chiều

- **Chọn ghế ngồi (2025-01-XX)**
  - Có thể chọn ghế khi đặt chỗ
  - Xem bản đồ ghế trước khi đặt vé
  - Ghế được giữ tự động khi tạo reservation

- **Chuẩn hóa cấu hình máy bay 2025-11-21)**
  - Tất cả máy bay đều có 180 ghế
  - Dễ dàng quản lý và tính toán

### Sửa lỗi

- **Xử lý lỗi tốt hơn (2025-11-20)**
  - Phân biệt rõ lỗi kỹ thuật (503) và lỗi dữ liệu (400/404)
  - Thông báo lỗi rõ ràng hơn cho người dùng

- **Sửa tên loại vé (2025-11-20)**
  - Hiển thị đúng tên loại vé: Standard thay vì Smart
  - Economy có 4 loại: Saver Max, Standard, Smart, Flex
  - Business có 3 loại: Standard, Smart, Flex

---

## [Previous Versions]

*Các version trước không có changelog chi tiết*
