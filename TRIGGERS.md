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

## Tổng Kết

| Trigger | Bảng | Sự kiện | Mục đích chính |
|---------|------|---------|----------------|
| `trg_Users_UpdateTimestamp` | `Users` | AFTER UPDATE | Cập nhật `updated_at` |
| `trg_FlightInstances_UpdateTimestamp` | `FlightInstances` | AFTER UPDATE | Cập nhật `updated_at` |
| `trg_Bookings_UpdateTimestamp` | `Bookings` | AFTER UPDATE | Cập nhật `updated_at` |
| `trg_BookingSegments_SeatAvailability_IUD` | `BookingSegments` | AFTER INSERT, UPDATE, DELETE | Quản lý trạng thái khả dụng của ghế |

---

## Lưu Ý

1. **Performance:** Các trigger timestamp có thể ảnh hưởng nhẹ đến hiệu suất khi có nhiều cập nhật đồng thời. Tuy nhiên, với quy mô thông thường, ảnh hưởng là không đáng kể.

2. **Seat Availability Trigger:** Trigger này đảm bảo tính toàn vẹn dữ liệu nhưng cần lưu ý:
   - Khi có nhiều booking đồng thời cho cùng một ghế, cần có cơ chế khóa (locking) ở tầng application để tránh race condition.
   - Trigger chỉ xử lý logic cập nhật trạng thái, không xử lý validation về việc ghế đã được đặt hay chưa.

3. **Maintenance:** Khi thay đổi cấu trúc bảng (thêm/xóa cột `updated_at`), cần cập nhật hoặc xóa trigger tương ứng.

