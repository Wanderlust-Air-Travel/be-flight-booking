# Changelog

Tất cả các thay đổi quan trọng của project sẽ được ghi nhận trong file này.

## [Unreleased]

### Added

- **Reservation Microservice** (port 4005): Microservice mới xử lý reservation logic với Redis
  - Entry point: `src/microservices/reservation/main.reservation.ts`
  - Chạy bằng: `npm run start:reservation` hoặc `npm run start:reservation:dev`
  - Environment variables: `RESERVATION_MS_HOST`, `RESERVATION_MS_PORT`
  - **Sử dụng Redis** để lưu temporary state (không cần database table)
  - Reservation tự động expire sau 15 phút (configurable)
  - **Reservation APIs**:
    - `POST /reservations` - Tạo reservation, lưu vào Redis
    - `GET /reservations/:id` - Lấy reservation theo ID hoặc code (auto-detect)
    - `GET /reservations/code/:code` - Lấy reservation theo code
    - `POST /reservations/:id/cancel` - Hủy reservation
  - **Redis Setup**: Cần chạy Redis với Docker (`docker-compose up -d redis`)
  - **Redis Config**: `REDIS_HOST`, `REDIS_PORT`, `REDIS_RESERVATION_TTL` (default: 900 seconds)

- **Booking Microservice** (port 4004): Microservice mới xử lý booking logic
  - Entry point: `src/microservices/booking/main.booking.ts`
  - Chạy bằng: `npm run start:booking` hoặc `npm run start:booking:dev`
  - Environment variables: `BOOKING_MS_HOST`, `BOOKING_MS_PORT`

- **Booking APIs**:
  - `POST /bookings` - Tạo booking mới với passengers và segments
    - Tự động generate PNR code (6 ký tự alphanumeric, unique)
    - Transaction-safe với rollback support
    - Response: `{ bookingId, pnrCode, totalAmount, currencyCode, status }`
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

