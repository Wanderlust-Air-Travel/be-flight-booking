# Changelog - API Documentation Updates

## Ngày cập nhật: 2025-01-XX (Latest)

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
- `API_FLOW.md`: Cập nhật booking flow và reservation flow với multi-segment
- `API_DOCS.md`: Cập nhật reservation và booking endpoints
- `API_SEQUENCE_DIAGRAMS.md`: Cập nhật sequence diagrams với multi-segment flow
- `STATE_MANAGEMENT_RECOMMENDATIONS.md`: Mark Priority 1 & 2 as completed

#### 4. **Backward Compatibility**
- `ReservationResponseDto` vẫn có các fields cũ (`flightInstanceId`, `fareClassCode`, etc.) nhưng marked as deprecated
- `BookingService` vẫn support old format nếu reservation không có `segments` array

---

## Ngày cập nhật: 2025-01-XX (Previous)

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

#### 3. **API Flow Documentation**
- Tạo file `docs/api/API_FLOW.md` với:
  - Tổng quan kiến trúc hệ thống
  - Danh sách đầy đủ API endpoints
  - Flow chính (Booking Flow)
  - Flow chi tiết từng API
  - Data Flow Diagram
  - Authentication & Authorization
  - Error Handling
  - Link đến Sequence Diagrams

#### 4. **Documentation Links**
- Thêm link từ `API_FLOW.md` đến `API_SEQUENCE_DIAGRAMS.md`
- Tất cả diagrams sử dụng Mermaid format, có thể render trên GitHub

---

## Tổng kết

### Files đã tạo/cập nhật:

1. **`docs/api/API_SEQUENCE_DIAGRAMS.md`** (MỚI)
   - 10+ sequence diagrams chi tiết
   - Mô tả đầy đủ flow xử lý từ Client → API Gateway → Microservices → Database/Redis

2. **`docs/api/API_FLOW.md`** (MỚI)
   - Tài liệu tổng quan về API flow
   - Link đến sequence diagrams
   - Hướng dẫn sử dụng API

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

