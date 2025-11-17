# Changelog

Tất cả các thay đổi quan trọng của project sẽ được ghi nhận trong file này.

## [Unreleased]

### Added

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
- Routes API cần Routes Microservice (port 4003)
- Services API cần Services Microservice (port 4002)
- Image URLs: `/images/routes/{uuid-v7}.jpg`
- Service links: `/service/{uuid-v7}`
- Pricing: Average từ bookings, format "962,000 VND"
- Deals API: Mỗi route có thể có cả one-way và round-trip deals (nếu có return route)

---

## [Previous Versions]

*Các version trước không có changelog chi tiết*

