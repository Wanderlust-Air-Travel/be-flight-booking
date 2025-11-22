# SQL Scripts Guide

Hướng dẫn về các file SQL trong project, mục đích và cách sử dụng từng file.

## Tổng quan

Tất cả SQL scripts được tổ chức trong thư mục `sql/` với cấu trúc phân loại rõ ràng:

```
sql/
├── schema/                    # Database schema scripts
└── utils/                     # Utility scripts
    ├── data-management/       # Quản lý dữ liệu
    ├── testing/               # Hỗ trợ testing API
    └── debugging/             # Debug và kiểm tra data
```

Xem chi tiết cấu trúc tại: [sql/README.md](./sql/README.md)

Project này có 2 loại SQL scripts:
1. **Database Schema Scripts**: Tạo database và tables
2. **Utility/Helper Scripts**: Các query hỗ trợ testing và debugging

---

## Database Schema Scripts

### `sql/schema/flight_booking_db.sql`

**Mục đích:** Tạo database schema từ đầu (tất cả tables, constraints, indexes)

**Công dụng:**
- Tạo database `flight_booking_db`
- Tạo tất cả tables với đầy đủ columns, data types, constraints
- Tạo foreign keys, unique constraints, indexes
- Thiết lập default values và triggers (nếu có)

**Khi nào sử dụng:**
- Lần đầu setup database
- Khi cần tạo lại database từ đầu
- Khi có thay đổi schema mới

**Cách sử dụng:**
1. Mở SQL Server Management Studio (SSMS)
2. Kết nối đến SQL Server instance
3. Mở file `sql/schema/flight_booking_db.sql`
4. Kiểm tra và sửa database name nếu cần (dòng 4): `CREATE DATABASE flight_booking_db;`
5. Chạy toàn bộ script (F5 hoặc Execute)

**Lưu ý:**
- Script này sẽ tạo database mới, nếu database đã tồn tại sẽ báo lỗi
- Nếu muốn tạo lại, xóa database cũ trước: `DROP DATABASE flight_booking_db;`
- **KHÔNG dùng `DEFAULT NEWSEQUENTIALID()`**: Tất cả IDs phải được generate từ application code (UUID v7)

---

## Data Management Scripts

### `sql/utils/data-management/clear-all-seed-data.sql`

**Mục đích:** Xóa toàn bộ dữ liệu đã seed để có thể chạy lại seed script

**Công dụng:**
- Xóa tất cả data trong database theo đúng thứ tự foreign key constraints
- Xóa từ child tables đến parent tables để tránh lỗi foreign key violation
- Sử dụng transaction để đảm bảo an toàn (rollback nếu có lỗi)
- Hiển thị progress cho từng bảng

**Khi nào sử dụng:**
- Khi muốn reset database và seed lại từ đầu
- Khi seed script bị lỗi và cần xóa data cũ
- Khi muốn test lại với data mới

**Cách sử dụng:**
1. Mở SQL Server Management Studio (SSMS)
2. Kết nối đến database
3. Mở file `sql/utils/data-management/clear-all-seed-data.sql`
4. **Quan trọng**: Kiểm tra và sửa database name (dòng 6):
   ```sql
   USE flight_booking_db;  -- Thay đổi nếu database name khác
   ```
5. Chạy script (F5 hoặc Execute)
6. Sau khi xóa xong, chạy lại: `npm run seed:full`

**Lưu ý:**
- Script xóa cả master data (Currencies, PaymentMethods) - comment nếu muốn giữ lại
- Script sử dụng transaction, nếu có lỗi sẽ tự động rollback
- Xóa theo thứ tự: Tickets → Payments → BookingSegments → BookingPassengers → Bookings → FlightSeats → FlightInstances → FlightSchedules → Routes → Passengers → Users → Aircrafts → SeatConfigurations → FareClasses → Airports → AircraftTypes → CabinClasses → Currencies → PaymentMethods

---

### `sql/utils/data-management/add-image-link-to-routes.sql`

**Mục đích:** Migration script để thêm `image_url` và `service_link` vào bảng `Routes`

**Công dụng:**
- Thêm 2 columns mới: `image_url` và `service_link` vào bảng `Routes`
- Cập nhật dữ liệu hiện có sang format mới
- Thêm CHECK constraints để validate format
- Tạo index để tối ưu query

**Format chuẩn:**
- `image_url`: `/images/routes/{route_id}.jpg` (route_id là UUID v7 - 36 ký tự, length = 55)
- `service_link`: `/service/{route_id}` (route_id là UUID v7 - 36 ký tự, length = 45)

**Khi nào sử dụng:**
- Khi cần thêm `image_url` và `service_link` vào database hiện có
- Khi upgrade database schema để hỗ trợ Services API (`/services/deals`)

**Cách sử dụng:**
1. Mở SQL Server Management Studio (SSMS)
2. Kết nối đến database
3. Mở file `sql/utils/data-management/add-image-link-to-routes.sql`
4. **Quan trọng**: Kiểm tra và sửa database name (dòng 6):
   ```sql
   USE flight_booking_db;  -- Thay đổi nếu database name khác
   ```
5. Chạy script (F5 hoặc Execute)
6. Script sẽ tự động:
   - Thêm columns nếu chưa tồn tại
   - Drop constraints cũ (nếu có)
   - Update dữ liệu hiện có sang format mới
   - Thêm CHECK constraints mới
   - Verify dữ liệu

**Lưu ý:**
- Script idempotent: có thể chạy nhiều lần mà không gây lỗi
- Script sẽ tự động update tất cả routes hiện có sang format mới
- Có validation để đảm bảo format đúng (CHECK constraints)
- Xem chi tiết tại: [MIGRATION-GUIDE.md](./sql/utils/data-management/MIGRATION-GUIDE.md)

---

### `sql/utils/data-management/create-trigger-auto-generate-image-link.sql`

**Mục đích:** Tạo trigger tự động generate `image_url` và `service_link` khi INSERT/UPDATE routes

**Công dụng:**
- Tự động generate `image_url` và `service_link` nếu NULL hoặc không đúng format
- Đảm bảo tất cả routes mới đều có format đúng
- Trigger chạy sau mỗi INSERT hoặc UPDATE

**Khi nào sử dụng:**
- Sau khi chạy migration script `add-image-link-to-routes.sql`
- Khi muốn đảm bảo routes mới tự động có `image_url` và `service_link`

**Lưu ý:**
- Trigger này đã được tích hợp vào `sql/schema/flight_booking_db.sql` (nếu tạo database mới)
- Chỉ cần chạy script này nếu database đã tồn tại và chưa có trigger
- Xem chi tiết tại: [TRIGGERS.md](./TRIGGERS.md)

---

### `sql/utils/data-management/validate-routes-image-link.sql`

**Mục đích:** Script kiểm tra validation format của `image_url` và `service_link`

**Công dụng:**
- Kiểm tra tất cả routes có `image_url` và `service_link` đúng format không
- Hiển thị routes có lỗi (nếu có)
- Thống kê số lượng routes hợp lệ

**Khi nào sử dụng:**
- Sau khi chạy migration script để verify dữ liệu
- Khi cần kiểm tra format của `image_url` và `service_link`
- Khi debug lỗi format trong Services API

**Cách sử dụng:**
1. Mở file trong SSMS
2. Kiểm tra và sửa database name (dòng 6)
3. Chạy script
4. Xem kết quả:
   - Query 1: Hiển thị 20 routes gần nhất với status (Valid/Invalid)
   - Query 2: Chỉ hiển thị routes có lỗi (nếu có)
   - Query 3: Thống kê tổng quan (total, valid, invalid)

---

## Testing Scripts

Các script này giúp tìm dữ liệu hợp lệ để test API trên Postman.

### `sql/utils/get-user-id-for-test.sql`

**Mục đích:** Lấy user_id hợp lệ (UUID v7 format) nhanh để test booking APIs

**Công dụng:**
- Lấy một user_id ngẫu nhiên từ database
- Đảm bảo user_id là UUID v7 format (không phải NEWSEQUENTIALID())
- Hiển thị thông tin user: email, fullname

**Khi nào sử dụng:**
- Khi cần user_id để test booking APIs
- Khi cần verify user_id format là UUID v7

---

### `sql/utils/get-passenger-id-for-test.sql`

**Mục đích:** Lấy passenger_id nhanh để test booking APIs

**Công dụng:**
- Lấy một passenger_id ngẫu nhiên từ database
- Hiển thị thông tin passenger: fullname, documentNumber, user_id

**Khi nào sử dụng:**
- Khi cần passenger_id để test booking APIs
- Khi test với passenger đã có sẵn

---

### `sql/utils/get-route-id-for-test.sql`

**Mục đích:** Lấy route_id để test upload ảnh

**Công dụng:**
- Lấy route_id từ database
- Hiển thị thông tin route: origin, destination, route_id

**Khi nào sử dụng:**
- Khi cần route_id để test API `POST /routes/:routeId/upload-image`

---

### `sql/utils/get-single-route-id.sql`

**Mục đích:** Lấy 1 route_id nhanh để test upload ảnh

**Công dụng:**
- Query đơn giản để lấy route_id đầu tiên
- Nhanh hơn `get-route-id-for-test.sql`

**Khi nào sử dụng:**
- Khi cần route_id nhanh để test

---

### `sql/utils/check-single-route-image.sql`

**Mục đích:** Kiểm tra image của một route cụ thể

**Công dụng:**
- Kiểm tra route có `image_url` và `service_link` không
- Verify format của image_url và service_link

**Khi nào sử dụng:**
- Sau khi upload ảnh, cần verify route đã có image_url chưa

---

### `sql/utils/check-uploaded-route-images.sql`

**Mục đích:** Kiểm tra các route đã upload ảnh

**Công dụng:**
- Liệt kê tất cả routes đã có `image_url`
- Thống kê số lượng routes có/không có image

**Khi nào sử dụng:**
- Kiểm tra tổng quan routes đã upload ảnh
- Verify sau khi upload hàng loạt

---

### `sql/utils/test-connection.sql`

**Mục đích:** Test database connection và kiểm tra user permissions

**Công dụng:**
- Kiểm tra login có tồn tại và enabled không
- Kiểm tra database user và permissions
- Hướng dẫn test connection

**Khi nào sử dụng:**
- Khi gặp lỗi "Login failed"
- Khi cần verify database connection

---

### `sql/utils/testing/find-valid-flight-instance-ids.sql`

**Mục đích:** Tìm các `flightInstanceId` hợp lệ để test API `/search/fare-options`

**Công dụng:**
- Tìm tất cả flight instances có seats available cho cabin type (economy hoặc business)
- Hiển thị thông tin chi tiết: flight number, date, route, available seats
- Tìm flight instances có cả economy và business seats
- Top 20 flight instances gần nhất (từ hôm nay)
- Query đơn giản để copy `flightInstanceId` vào Postman

**Khi nào sử dụng:**
- Khi cần test API `/search/fare-options` nhưng không biết `flightInstanceId` nào hợp lệ
- Khi muốn kiểm tra xem có flight instances nào có seats available không
- Khi debug lỗi "Flight instance not found" hoặc "No available seats"

**Cách sử dụng:**
1. Mở file trong SSMS
2. Thay đổi biến `@cabinType` nếu cần (dòng 5): `'economy'` hoặc `'business'`
3. Chạy script
4. Copy `flightInstanceId` từ kết quả query 4 (query đơn giản nhất)
5. Dán vào Postman request: `/search/fare-options?flightInstanceId=<copied-id>&cabinType=economy`

**Output:**
- Query 1: Danh sách chi tiết flight instances với available seats
- Query 2: Flight instances có cả economy và business
- Query 3: Top 20 flight instances gần nhất có cả 2 cabin types
- Query 4: Query đơn giản để copy `flightInstanceId` (khuyến nghị dùng query này)

---

### `sql/utils/testing/find-valid-flight-instance-ids-business.sql`

**Mục đích:** Tìm các `flightInstanceId` hợp lệ để test API `/search/fare-options` với `cabinType=business`

**Công dụng:**
- Tìm tất cả flight instances có business seats available
- Hiển thị thông tin chi tiết: flight number, date, route, available business seats
- Top 20 flight instances gần nhất có business seats
- Tìm flight instances có cả business và economy (để test cả 2 cabin types)

**Khi nào sử dụng:**
- Khi cần test API `/search/fare-options` với `cabinType=business` nhưng không biết `flightInstanceId` nào hợp lệ
- Khi muốn kiểm tra xem có flight instances nào có business seats available không
- Khi debug lỗi "No business seats available" hoặc "Flight instance not found"

**Cách sử dụng:**
1. Mở file trong SSMS
2. Chạy script (tất cả queries hoặc chỉ query 2 - query đơn giản nhất)
3. Copy `flightInstanceId` từ kết quả query 2 (khuyến nghị)
4. Dán vào Postman request: `/search/fare-options?flightInstanceId=<copied-id>&cabinType=business`

**Output:**
- Query 1: Danh sách chi tiết flight instances với business seats available
- Query 2: Query đơn giản để copy `flightInstanceId` (khuyến nghị dùng query này)
- Query 3: Top 20 flight instances gần nhất có business seats
- Query 4: Flight instances có cả business và economy (để test cả 2 cabin types)

---

### `sql/utils/testing/find-valid-dates-sgn-pqc.sql`

**Mục đích:** Tìm các ngày có flights hợp lệ cho route SGN → PQC

**Công dụng:**
- Tìm tất cả các ngày có flights với đủ seats available
- Hiển thị số lượng flights và tổng seats available cho mỗi ngày
- Chi tiết từng flight cho mỗi ngày
- Tóm tắt: tổng số ngày, ngày sớm nhất, ngày muộn nhất

**Khi nào sử dụng:**
- Khi test API `/search/flights` với route SGN → PQC nhưng không biết ngày nào có data
- Khi muốn kiểm tra xem route này có flights trong khoảng thời gian nào

**Cách sử dụng:**
1. Mở file trong SSMS
2. Có thể thay đổi route (dòng 5-6): `@originIATA` và `@destIATA`
3. Chạy script
4. Copy một ngày từ kết quả để test API:
   ```
   GET /search/flights?origin=SGN&destination=PQC&departDate=2025-11-18&tripType=one_way&adults=1&minors=0
   ```

**Output:**
- Query 1: Danh sách các ngày có flights (chỉ ngày, số flights, tổng seats)
- Query 2: Chi tiết từng flight cho mỗi ngày
- Query 3: Tóm tắt (tổng số ngày, ngày sớm nhất, ngày muộn nhất)

---

### `sql/utils/testing/find-valid-round-trip-dates-han-sgn.sql`

**Mục đích:** Tìm các cặp ngày hợp lệ cho round trip HAN ↔ SGN

**Công dụng:**
- Tìm tất cả các cặp ngày (departDate, returnDate) hợp lệ cho round trip
- Đảm bảo có flights cho cả 2 chiều (HAN → SGN và SGN → HAN)
- Hiển thị số ngày giữa depart và return
- Top 20 cặp ngày gần nhất

**Khi nào sử dụng:**
- Khi test API `/search/flights` với `tripType=round_trip` cho route HAN ↔ SGN
- Khi muốn tìm các cặp ngày hợp lệ để test round trip booking flow

**Cách sử dụng:**
1. Mở file trong SSMS
2. Có thể thay đổi route (dòng 5-6): `@originIATA` và `@destIATA`
3. Chạy script
4. Copy một cặp ngày từ kết quả để test API:
   ```
   # Auto tripType (recommended):
   GET /search/flights?origin=HAN&destination=SGN&departDate=2025-11-18&returnDate=2025-11-25&adults=2&minors=1
   
   # Explicit tripType:
   GET /search/flights?origin=HAN&destination=SGN&departDate=2025-11-18&returnDate=2025-11-25&tripType=round_trip&adults=2&minors=1
   ```
   *Note: `tripType` là optional. Khi có `returnDate`, `tripType` tự động set thành `round_trip`.

**Output:**
- Query 1: Tất cả các cặp ngày hợp lệ với số flights mỗi chiều
- Query 2: Tóm tắt (tổng số cặp, ngày đi sớm nhất/muộn nhất, ngày về sớm nhất/muộn nhất)
- Query 3: Top 20 cặp ngày gần nhất

---

## Debugging Scripts

Các script này giúp debug và kiểm tra data khi gặp vấn đề.

### `sql/utils/debugging/quick-check-han-dad.sql`

**Mục đích:** Query nhanh để kiểm tra flights HAN → DAD cho một ngày cụ thể

**Công dụng:**
- Kiểm tra flights cho route HAN → DAD vào một ngày cụ thể
- Hiển thị thông tin chi tiết: flight instance ID, số seats, available seats
- Kiểm tra xem flights có được trả về bởi API không
- Diagnostic queries: kiểm tra route, schedules, instances

**Khi nào sử dụng:**
- Khi test API với route HAN → DAD nhưng không có kết quả
- Khi muốn debug tại sao API không trả về flights cho một ngày cụ thể
- Khi muốn kiểm tra nhanh data cho route này

**Cách sử dụng:**
1. Mở file trong SSMS
2. **Quan trọng**: Thay đổi `@departDate` (dòng 6): `'2025-11-18'` → ngày bạn muốn test
3. Chạy script
4. Xem kết quả:
   - Nếu có flights: Copy `flightInstanceId` để test API
   - Nếu không có: Xem các diagnostic queries để tìm nguyên nhân

**Output:**
- Query chính: Danh sách flights cho ngày cụ thể
- Diagnostic queries:
  - Route Check: Kiểm tra route có tồn tại không
  - Schedules Check: Kiểm tra schedules có active không
  - Instances Check: Kiểm tra instances có được tạo không
  - Nearest Dates: Tìm ngày gần nhất có flights

---

### `sql/utils/debugging/quick-check-sgn-pqc.sql`

**Mục đích:** Query nhanh để kiểm tra flights SGN → PQC cho một ngày cụ thể

**Công dụng:**
- Tương tự `quick-check-han-dad.sql` nhưng cho route SGN → PQC
- Kiểm tra flights cho một ngày cụ thể
- Diagnostic queries để tìm nguyên nhân nếu không có flights

**Khi nào sử dụng:**
- Khi test API với route SGN → PQC
- Khi debug tại sao không có flights cho ngày này

**Cách sử dụng:**
1. Mở file trong SSMS
2. Thay đổi `@departDate` (dòng 6): `'2025-11-18'` → ngày bạn muốn test
3. Chạy script
4. Xem kết quả và diagnostic queries

---

### `sql/utils/debugging/check-han-dad-flights.sql`

**Mục đích:** Kiểm tra chi tiết flights cho route HAN → DAD (comprehensive check)

**Công dụng:**
- Kiểm tra airports có tồn tại không
- Kiểm tra route có tồn tại không
- Kiểm tra schedules có active không
- Kiểm tra instances có được tạo không
- Kiểm tra seats có available không
- Hiển thị thông tin chi tiết cho từng bước

**Khi nào sử dụng:**
- Khi cần debug sâu hơn về route HAN → DAD
- Khi muốn kiểm tra toàn bộ data chain: airports → routes → schedules → instances → seats
- Khi API không trả về kết quả và cần tìm nguyên nhân

**Cách sử dụng:**
1. Mở file trong SSMS
2. Thay đổi `@departDate` (dòng 6) nếu cần
3. Chạy script
4. Xem từng query result để tìm vấn đề:
   - Nếu không có airports → Chạy seed script
   - Nếu không có route → Seed script chưa tạo route này
   - Nếu không có schedules → Seed script chưa tạo schedules cho route này
   - Nếu không có instances → Seed script chưa tạo instances cho ngày này

---

### `sql/utils/debugging/check-han-dad-instances-any-date.sql`

**Mục đích:** Kiểm tra xem có flight instances nào cho route HAN → DAD không (bất kỳ ngày nào)

**Công dụng:**
- Tìm tất cả flight instances cho route HAN → DAD, không giới hạn ngày
- Hiển thị thông tin: flight number, date, seats, status
- Kiểm tra xem route này có được seed instances không

**Khi nào sử dụng:**
- Khi muốn kiểm tra xem route HAN → DAD có instances nào không (không quan tâm ngày cụ thể)
- Khi debug tại sao không có flights cho route này
- Khi muốn xem tổng quan về instances của route này

**Cách sử dụng:**
1. Mở file trong SSMS
2. Chạy script
3. Xem kết quả:
   - Nếu có instances: Route đã được seed, có thể test với các ngày trong kết quả
   - Nếu không có: Route chưa có instances, cần chạy seed script hoặc kiểm tra seed logic

---

## Tóm tắt

| File | Loại | Mục đích chính | Khi nào dùng |
|------|------|----------------|--------------|
| `sql/schema/flight_booking_db.sql` | Schema | Tạo database và tables | Setup database lần đầu |
| `sql/utils/data-management/clear-all-seed-data.sql` | Data Management | Xóa toàn bộ seed data | Reset database để seed lại |
| `sql/utils/testing/find-valid-flight-instance-ids.sql` | Testing | Tìm flightInstanceId hợp lệ (economy) | Test API fare-options economy |
| `sql/utils/testing/find-valid-flight-instance-ids-business.sql` | Testing | Tìm flightInstanceId hợp lệ (business) | Test API fare-options business |
| `sql/utils/testing/find-valid-dates-sgn-pqc.sql` | Testing | Tìm ngày có flights SGN→PQC | Test API search flights |
| `sql/utils/testing/find-valid-round-trip-dates-han-sgn.sql` | Testing | Tìm cặp ngày round trip HAN↔SGN | Test API round trip |
| `sql/utils/testing/find-valid-passenger-ids.sql` | Testing | Tìm passenger IDs (nhiều options) | Test booking APIs |
| `sql/utils/testing/find-valid-user-ids.sql` | Testing | Tìm user IDs (nhiều options) | Test booking APIs |
| `sql/utils/get-user-id-for-test.sql` | Testing | Lấy user_id (UUID v7) nhanh | Test booking APIs |
| `sql/utils/get-passenger-id-for-test.sql` | Testing | Lấy passenger_id nhanh | Test booking APIs |
| `sql/utils/get-route-id-for-test.sql` | Testing | Lấy route_id để test | Test upload image API |
| `sql/utils/get-single-route-id.sql` | Testing | Lấy 1 route_id nhanh | Test upload image API |
| `sql/utils/check-single-route-image.sql` | Testing | Kiểm tra image của route | Verify sau upload |
| `sql/utils/check-uploaded-route-images.sql` | Testing | Kiểm tra routes đã upload ảnh | Verify tổng quan |
| `sql/utils/test-connection.sql` | Testing | Test database connection | Debug connection issues |
| `sql/utils/debugging/quick-check-han-dad.sql` | Debugging | Kiểm tra nhanh HAN→DAD | Debug API không trả về kết quả |
| `sql/utils/debugging/quick-check-sgn-pqc.sql` | Debugging | Kiểm tra nhanh SGN→PQC | Debug API không trả về kết quả |
| `sql/utils/debugging/check-han-dad-flights.sql` | Debugging | Kiểm tra chi tiết HAN→DAD | Debug sâu về data chain |
| `sql/utils/debugging/check-han-dad-instances-any-date.sql` | Debugging | Kiểm tra instances HAN→DAD | Kiểm tra route có instances không |

---

## Best Practices

1. **Luôn backup database** trước khi chạy `clear-all-seed-data.sql`
2. **Kiểm tra database name** trong các scripts trước khi chạy
3. **Sử dụng transaction** khi chạy các script xóa data
4. **Test trên development database** trước khi chạy trên production
5. **Đọc comments** trong mỗi script để hiểu rõ mục đích

---

## Liên quan

- [sql/README.md](../sql/README.md) - Cấu trúc thư mục SQL scripts
- [SEED-README.md](./SEED-README.md) - Hướng dẫn về seed scripts
- [TRIGGERS.md](./TRIGGERS.md) - Database triggers documentation
- [ERD.md](./ERD.md) - Entity Relationship Diagram

