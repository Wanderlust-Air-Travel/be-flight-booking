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
  - Response: `{ deals: [{ image, title, link, startDate, endDate, service, price }] }`
  - Cần Services Microservice chạy (port 4002): `npm run start:services:dev`

- **Database**: Bảng Routes thêm `image_url` và `service_link`
  - Format: `/images/routes/{route_id}.jpg` và `/service/{route_id}`
  - `route_id` là UUID v7 (36 ký tự)

### Changed

- **Pricing**: Chỉ dùng historical pricing (average từ BookingSegments), bỏ fallback
- **Image/Link format**: Dùng UUID v7 thay vì số tự tăng

### Notes for Frontend

- Routes API cần Routes Microservice (port 4003)
- Services API cần Services Microservice (port 4002)
- Image URLs: `/images/routes/{uuid-v7}.jpg`
- Service links: `/service/{uuid-v7}`
- Pricing: Average từ bookings, format "962,000 VND"

---

## [Previous Versions]

*Các version trước không có changelog chi tiết*

