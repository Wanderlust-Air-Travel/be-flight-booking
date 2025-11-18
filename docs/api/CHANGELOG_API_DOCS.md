# Changelog - API Documentation Updates

## Ngày cập nhật: 2025-11-19 (Latest)

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
- `API_FLOW.md`: Updated reservation flow với Hybrid Approach details
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
- `API_FLOW.md`: Cập nhật booking flow và reservation flow với multi-segment
- `API_DOCS.md`: Cập nhật reservation và booking endpoints
- `API_SEQUENCE_DIAGRAMS.md`: Cập nhật sequence diagrams với multi-segment flow
- `STATE_MANAGEMENT_RECOMMENDATIONS.md`: Mark Priority 1 & 2 as completed

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

