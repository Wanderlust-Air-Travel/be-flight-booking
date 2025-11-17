# Changelog

Tất cả các thay đổi quan trọng của project sẽ được ghi nhận trong file này.

## [Unreleased]

### Added

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

- **Fare Options API**: `/search/fare-options` response format đã thay đổi để tương thích với FE
  - Response format mới: Array `[{ id, type, code, list: [...] }]` thay vì object
  - Mỗi fare option có thêm `typeTicket` field (tên hiển thị)
  - Mỗi fare option có `desc` array chứa các mô tả chi tiết với `text` và `status` (true/false)
  - `desc` bao gồm: baggage rules, refund rules, change rules, loyalty points, seat selection, etc.
  - Format này match với FE requirement từ UI mockup

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
- **Booking Flow**: 
  1. Search flights → `/search/flights`
  2. Chọn flight → Get fare options → `/search/fare-options` (response format: `[{ id, type, code, list: [...] }]`)
  3. Chọn fare class → Create booking → `POST /bookings`
  4. Xem fare details → `GET /bookings/:id/fare-details`
  5. Update passengers (nếu cần) → `PATCH /bookings/:id/passengers`
  6. Get payment info → `GET /bookings/:id/payment-info`
- **Fare Options Response**: Format mới với `desc` array cho mỗi fare option, mỗi item có `text` và `status` (true/false)
- Routes API cần Routes Microservice (port 4003)
- Services API cần Services Microservice (port 4002)
- Booking APIs cần Booking Microservice (port 4004)
- Image URLs: `/images/routes/{uuid-v7}.jpg`
- Service links: `/service/{uuid-v7}`
- Pricing: Average từ bookings, format "962,000 VND"
- Deals API: Mỗi route có thể có cả one-way và round-trip deals (nếu có return route)

---

## [Previous Versions]

*Các version trước không có changelog chi tiết*

