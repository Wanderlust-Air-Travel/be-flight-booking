# Migration Guide: Thêm image_url và service_link vào Routes

## Mục đích

Thêm 2 columns mới vào bảng `Routes` với **format chuẩn và validation**:
- `image_url`: Đường dẫn đến hình ảnh deal
- `service_link`: Link đến trang chi tiết service

## Format Chuẩn

### `image_url`
- **Format**: `/images/routes/{route_id}.jpg`
- **Pattern**: `/images/routes/` + UUID v7 của route + `.jpg`
- **Ví dụ hợp lệ**: `/images/routes/019a8f4a-bb0e-7402-a0c4-27647b89dc71.jpg`
- **Ví dụ không hợp lệ**: `/s1.jpg`, `/image1.jpg`, `/routes/xxx.jpg`
- **Validation**: 
  - Phải bắt đầu bằng `/images/routes/`
  - Phần route_id phải là UUID v7 của chính route đó (36 ký tự)
  - Phải kết thúc bằng `.jpg`
  - Độ dài: 55 ký tự (`/images/routes/` = 15 + UUID v7 = 36 + `.jpg` = 4)

### `service_link`
- **Format**: `/service/{route_id}`
- **Pattern**: `/service/` + UUID v7 của route
- **Ví dụ hợp lệ**: `/service/019a8f4a-bb0e-7402-a0c4-27647b89dc71`
- **Ví dụ không hợp lệ**: `/service/1`, `/service/abc`, `/route/xxx`
- **Validation**:
  - Phải bắt đầu bằng `/service/`
  - Phần sau phải là UUID v7 của chính route đó (36 ký tự)
  - Độ dài: 45 ký tự (`/service/` = 9 + UUID v7 = 36)

## Tại sao cần format chuẩn?

1. **Xác định route**: Từ `image_url` và `service_link` có thể extract `route_id` để biết thuộc route nào
2. **Theo thực tế**: Format này giống các doanh nghiệp thực tế (dùng ID của chính record)
3. **Validation**: CHECK constraints ngăn chặn insert data không đúng format
4. **Consistency**: Tất cả routes có cùng format, dễ quản lý và maintain
5. **Auto-generation**: Trigger tự động generate nếu format không đúng

## Cách chạy Migration trên MSSQL

### Bước 1: Mở SQL Server Management Studio (SSMS)

1. Mở **SQL Server Management Studio**
2. Kết nối đến SQL Server instance của bạn

### Bước 2: Chọn Database

```sql
USE flight_booking_db;
GO
```

Hoặc chọn database `flight_booking_db` từ dropdown trong SSMS.

### Bước 3: Mở và chạy Migration Script

1. Mở file: `sql/utils/data-management/add-image-link-to-routes.sql`
2. Copy toàn bộ nội dung
3. Paste vào SSMS Query Editor
4. Nhấn **F5** hoặc click **Execute** để chạy script

### Bước 4: Verify kết quả

Script sẽ tự động:
- Thêm 2 columns `image_url` và `service_link` vào bảng `Routes`
- Cập nhật dữ liệu cho tất cả routes hiện có
- Tạo index để tối ưu query
- Hiển thị 10 routes đầu tiên để verify

**Kết quả mong đợi:**
```
route_id                                  image_url    service_link
----------------------------------------  -----------  ---------------------------
xxx-xxx-xxx-xxx                          /s45.jpg     /service/xxx-xxx-xxx-xxx
...
```

## Kiểm tra thủ công

Sau khi chạy migration, bạn có thể kiểm tra:

```sql
-- Kiểm tra columns đã được thêm
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Routes'
AND COLUMN_NAME IN ('image_url', 'service_link');
GO

-- Kiểm tra dữ liệu đã được cập nhật
SELECT TOP 10
    route_id,
    image_url,
    service_link,
    (SELECT iata_code FROM Airports WHERE airport_id = Routes.origin_airport_id) AS origin,
    (SELECT iata_code FROM Airports WHERE airport_id = Routes.destination_airport_id) AS destination
FROM Routes
WHERE is_domestic = 1
ORDER BY created_at DESC;
GO
```

## Rollback (nếu cần)

Nếu muốn rollback (xóa columns), chạy:

```sql
USE flight_booking_db;
GO

-- Xóa index trước
DROP INDEX IF EXISTS IX_Routes_ImageUrl ON Routes;
GO

-- Xóa columns
ALTER TABLE Routes
DROP COLUMN image_url, service_link;
GO
```

## Lưu ý

- Migration script sẽ tự động generate `image_url` và `service_link` cho tất cả routes hiện có theo format chuẩn
- `image_url` = `/images/routes/{route_id}.jpg` (dùng route_id để xác định route)
- `service_link` = `/service/{route_id}` (route_id là UUID v7 - 36 ký tự)
- **CHECK constraints** sẽ ngăn chặn insert/update data không đúng format
- **Trigger** sẽ tự động sửa format nếu không đúng khi INSERT/UPDATE
- Sau khi chạy migration, code sẽ tự động lấy từ database thay vì generate

## Validation Rules

Database sẽ tự động reject nếu:
- `image_url` không match pattern `/images/routes/{route_id}.jpg` hoặc length != 55 hoặc route_id không khớp
- `service_link` không match pattern `/service/{route_id}` hoặc route_id không khớp

## Kiểm tra validation

Chạy script `validate-routes-image-link.sql` để kiểm tra routes có format không đúng:
```sql
-- Xem file: sql/utils/data-management/validate-routes-image-link.sql
```

