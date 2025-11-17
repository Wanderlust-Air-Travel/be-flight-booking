# Database Triggers Documentation

Tài liệu này mô tả các trigger được sử dụng trong database `flight_booking_db_v2`.

---

## 1. Trigger Cập Nhật Timestamp

### 1.1. `trg_Users_UpdateTimestamp`

**Bảng áp dụng:** `Users`

**Sự kiện:** `AFTER UPDATE`

**Mục đích:**
- Tự động cập nhật trường `updated_at` với thời gian hiện tại (`SYSDATETIME()`) mỗi khi có bản ghi trong bảng `Users` được cập nhật.
- Đảm bảo theo dõi thời gian chỉnh sửa thông tin người dùng một cách tự động, không cần can thiệp thủ công.

**Logic:**
```sql
UPDATE u
SET u.updated_at = SYSDATETIME()
FROM Users u
INNER JOIN inserted i ON u.user_id = i.user_id;
```

---

### 1.2. `trg_FlightInstances_UpdateTimestamp`

**Bảng áp dụng:** `FlightInstances`

**Sự kiện:** `AFTER UPDATE`

**Mục đích:**
- Tự động cập nhật trường `updated_at` mỗi khi thông tin chuyến bay thực tế được cập nhật (ví dụ: thay đổi trạng thái, thời gian bay, máy bay sử dụng...).
- Hữu ích cho việc audit và theo dõi các thay đổi quan trọng của chuyến bay.

**Logic:**
```sql
UPDATE f
SET f.updated_at = SYSDATETIME()
FROM FlightInstances f
INNER JOIN inserted i ON f.flight_instance_id = i.flight_instance_id;
```

---

### 1.3. `trg_Bookings_UpdateTimestamp`

**Bảng áp dụng:** `Bookings`

**Sự kiện:** `AFTER UPDATE`

**Mục đích:**
- Tự động cập nhật trường `updated_at` mỗi khi đặt chỗ được cập nhật (ví dụ: thay đổi trạng thái thanh toán, thông tin liên hệ, số tiền...).
- Giúp theo dõi lịch sử thay đổi của booking.

**Logic:**
```sql
UPDATE b
SET b.updated_at = SYSDATETIME()
FROM Bookings b
INNER JOIN inserted i ON b.booking_id = i.booking_id;
```

---

## 2. Trigger Quản Lý Trạng Thái Ghế

### 2.1. `trg_BookingSegments_SeatAvailability_IUD`

**Bảng áp dụng:** `BookingSegments`

**Sự kiện:** `AFTER INSERT, UPDATE, DELETE`

**Mục đích:**
- Tự động quản lý trạng thái khả dụng của ghế (`is_available`) trong bảng `FlightSeats` dựa trên việc ghế có được gán cho booking segment hay không.
- Đảm bảo tính nhất quán dữ liệu: khi một ghế được đặt, nó sẽ tự động được đánh dấu là không khả dụng; khi booking bị hủy hoặc ghế được giải phóng, ghế sẽ được mở lại nếu không còn booking nào sử dụng.

**Logic chi tiết:**

1. **Khi INSERT hoặc UPDATE (ghế mới được gán):**
   - Khóa ghế: Set `is_available = 0` cho các ghế trong `FlightSeats` mà `flight_seat_id` xuất hiện trong `inserted` và không phải NULL.

2. **Khi DELETE hoặc UPDATE (ghế bị bỏ):**
   - Mở lại ghế: Set `is_available = 1` cho các ghế trong `FlightSeats` mà `flight_seat_id` xuất hiện trong `deleted` và không phải NULL, **chỉ khi** không còn booking segment nào khác đang sử dụng ghế đó.

**Điều kiện quan trọng:**
- Chỉ mở lại ghế nếu không còn booking segment nào khác đang sử dụng (`NOT EXISTS` check).
- Điều này ngăn chặn việc mở lại ghế khi vẫn còn booking khác đang giữ ghế đó.

**Ví dụ sử dụng:**
- Khi khách hàng đặt ghế 12A cho một chuyến bay → ghế 12A tự động chuyển sang `is_available = 0`.
- Khi khách hàng hủy booking hoặc đổi ghế → ghế 12A tự động chuyển sang `is_available = 1` (nếu không có booking khác đang dùng).

---

## 3. Trigger Tự Động Generate Image URL và Service Link

### 3.1. `trg_Routes_AutoGenerateImageLink`

**Bảng áp dụng:** `Routes`

**Sự kiện:** `AFTER INSERT, UPDATE`

**Mục đích:**
- Tự động generate `image_url` và `service_link` cho routes khi INSERT hoặc UPDATE nếu các trường này NULL hoặc không đúng format.
- Đảm bảo tất cả routes đều có `image_url` và `service_link` theo format chuẩn.

**Format chuẩn:**
- `image_url`: `/images/routes/{route_id}.jpg` (route_id là UUID v7 - 36 ký tự, length = 55)
- `service_link`: `/service/{route_id}` (route_id là UUID v7 - 36 ký tự, length = 45)

**Logic:**
- Kiểm tra nếu `image_url` hoặc `service_link` là NULL hoặc không đúng format
- Tự động generate theo format chuẩn dựa trên `route_id` của route
- Validate format:
  - `image_url` phải bắt đầu bằng `/images/routes/`, kết thúc bằng `.jpg`, có length = 55, và UUID trong URL phải khớp với `route_id`
  - `service_link` phải bắt đầu bằng `/service/`, có length = 45, và UUID trong link phải khớp với `route_id`

**Ví dụ:**
- Route có `route_id` = `019a8f4a-bb0e-7402-a0c4-27647b89dc71`
- Trigger sẽ tự động set:
  - `image_url` = `/images/routes/019a8f4a-bb0e-7402-a0c4-27647b89dc71.jpg`
  - `service_link` = `/service/019a8f4a-bb0e-7402-a0c4-27647b89dc71`

**Lưu ý:**
- Trigger chỉ update nếu giá trị hiện tại là NULL hoặc không đúng format
- Nếu giá trị đã đúng format, trigger sẽ giữ nguyên
- Có CHECK constraints trong database để đảm bảo format đúng khi INSERT/UPDATE

---

## Tổng Kết

| Trigger | Bảng | Sự kiện | Mục đích chính |
|---------|------|---------|----------------|
| `trg_Users_UpdateTimestamp` | `Users` | AFTER UPDATE | Cập nhật `updated_at` |
| `trg_FlightInstances_UpdateTimestamp` | `FlightInstances` | AFTER UPDATE | Cập nhật `updated_at` |
| `trg_Bookings_UpdateTimestamp` | `Bookings` | AFTER UPDATE | Cập nhật `updated_at` |
| `trg_BookingSegments_SeatAvailability_IUD` | `BookingSegments` | AFTER INSERT, UPDATE, DELETE | Quản lý trạng thái khả dụng của ghế |
| `trg_Routes_AutoGenerateImageLink` | `Routes` | AFTER INSERT, UPDATE | Tự động generate `image_url` và `service_link` |

---

## Lưu Ý

1. **Performance:** Các trigger timestamp có thể ảnh hưởng nhẹ đến hiệu suất khi có nhiều cập nhật đồng thời. Tuy nhiên, với quy mô thông thường, ảnh hưởng là không đáng kể.

2. **Seat Availability Trigger:** Trigger này đảm bảo tính toàn vẹn dữ liệu nhưng cần lưu ý:
   - Khi có nhiều booking đồng thời cho cùng một ghế, cần có cơ chế khóa (locking) ở tầng application để tránh race condition.
   - Trigger chỉ xử lý logic cập nhật trạng thái, không xử lý validation về việc ghế đã được đặt hay chưa.

3. **Maintenance:** Khi thay đổi cấu trúc bảng (thêm/xóa cột `updated_at`, `image_url`, `service_link`), cần cập nhật hoặc xóa trigger tương ứng.

4. **Routes Image/Link Trigger:** Trigger này đảm bảo tất cả routes đều có `image_url` và `service_link` đúng format:
   - Format dựa trên UUID v7 của `route_id` để đảm bảo tính nhất quán
   - Có CHECK constraints để validate format ở database level
   - Trigger chỉ update nếu giá trị NULL hoặc không đúng format, giữ nguyên nếu đã đúng

