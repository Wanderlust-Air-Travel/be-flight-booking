# SQL Scripts Directory

Thư mục chứa tất cả các SQL scripts của project, được phân loại rõ ràng theo mục đích sử dụng.

## 📁 Cấu trúc thư mục

```
sql/
├── schema/                    # Database schema scripts
│   └── flight_booking_db.sql  # Tạo database và tables
│
└── utils/                     # Utility scripts
    ├── data-management/       # Scripts quản lý dữ liệu
    │   └── clear-all-seed-data.sql
    │
    ├── testing/               # Scripts hỗ trợ testing API
    │   ├── find-valid-flight-instance-ids.sql
    │   ├── find-valid-flight-instance-ids-business.sql
    │   ├── find-valid-dates-sgn-pqc.sql
    │   └── find-valid-round-trip-dates-han-sgn.sql
    │
    ├── get-route-id-for-test.sql  # Lấy route_id để test upload ảnh (nhiều options)
    └── get-single-route-id.sql    # Lấy 1 route_id nhanh để test upload ảnh
    │
    └── debugging/             # Scripts debug và kiểm tra data
        ├── quick-check-han-dad.sql
        ├── quick-check-sgn-pqc.sql
        ├── check-han-dad-flights.sql
        └── check-han-dad-instances-any-date.sql
```

## 📂 Chi tiết từng thư mục

### `schema/`
**Mục đích:** Chứa scripts tạo database schema

**Files:**
- `flight_booking_db.sql` - Script tạo database và tất cả tables từ đầu

**Khi nào dùng:**
- Setup database lần đầu
- Tạo lại database schema

---

### `utils/data-management/`
**Mục đích:** Scripts quản lý dữ liệu (xóa, reset, cleanup, migration)

**Files:**
- `clear-all-seed-data.sql` - Xóa toàn bộ seed data để chạy lại seed script
- `add-image-link-to-routes.sql` - Migration: Thêm `image_url` và `service_link` vào bảng Routes (có validation)
- `create-trigger-auto-generate-image-link.sql` - Tạo trigger tự động generate image/link theo format chuẩn
- `validate-routes-image-link.sql` - Script kiểm tra validation format của image_url và service_link

**Khi nào dùng:**
- Reset database để seed lại
- Cleanup data trước khi test
- Chạy migration để thêm columns mới vào database

---

### `utils/testing/`
**Mục đích:** Scripts hỗ trợ testing API, tìm dữ liệu hợp lệ

**Files:**
- `find-valid-flight-instance-ids.sql` - Tìm flightInstanceId hợp lệ để test API fare-options (economy)
- `find-valid-flight-instance-ids-business.sql` - Tìm flightInstanceId hợp lệ để test API fare-options (business)
- `find-valid-dates-sgn-pqc.sql` - Tìm ngày có flights cho route SGN → PQC
- `find-valid-round-trip-dates-han-sgn.sql` - Tìm cặp ngày hợp lệ cho round trip HAN ↔ SGN
- `get-route-id-for-test.sql` - Lấy route_id để test upload ảnh (nhiều options: tất cả, chưa có image, đã có image, với route detail)
- `get-single-route-id.sql` - Lấy 1 route_id nhanh để test upload ảnh
- `check-uploaded-route-images.sql` - Kiểm tra ảnh đã được upload và update vào database (verify sau khi upload)

**Khi nào dùng:**
- Khi test API trên Postman nhưng không biết dữ liệu nào hợp lệ
- Khi cần tìm flightInstanceId, dates, routes để test
- Khi cần route_id để test API upload ảnh (`POST /routes/:routeId/upload-image`)
- Sau khi upload ảnh, cần verify xem `image_url` đã được update vào database chưa

---

### `utils/debugging/`
**Mục đích:** Scripts debug và kiểm tra data, tìm nguyên nhân lỗi

**Files:**
- `quick-check-han-dad.sql` - Kiểm tra nhanh flights HAN → DAD cho một ngày
- `quick-check-sgn-pqc.sql` - Kiểm tra nhanh flights SGN → PQC cho một ngày
- `check-han-dad-flights.sql` - Kiểm tra chi tiết data chain cho route HAN → DAD
- `check-han-dad-instances-any-date.sql` - Kiểm tra instances HAN → DAD (bất kỳ ngày nào)

**Khi nào dùng:**
- Khi API không trả về kết quả và cần debug
- Khi muốn kiểm tra data có tồn tại không
- Khi cần tìm nguyên nhân tại sao không có flights

---

## 📖 Xem thêm

Xem chi tiết về từng file SQL tại: [SQL-SCRIPTS-GUIDE.md](../SQL-SCRIPTS-GUIDE.md)

