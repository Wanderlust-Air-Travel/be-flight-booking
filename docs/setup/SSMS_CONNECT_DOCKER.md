# Kết nối SSMS tới SQL Server trong Docker

Hướng dẫn kết nối SQL Server Management Studio (SSMS) tới SQL Server đang chạy trong Docker.

## Yêu cầu

- SSMS 18.x hoặc 22.x
- SQL Server container đang chạy: `docker-compose ps sqlserver`

## Thông tin kết nối

- **Server name**: `localhost,1434` (port 1434, không phải 1433)
- **Authentication**: SQL Server Authentication
- **Login**: `sa`
- **Password**: `Passw0rd123!`
- **Database**: `master` (khi kết nối lần đầu, **KHÔNG** chọn `flight_booking_db`)

> **Lưu ý:** Port 1434 trên host để tránh conflict với SQL Server local (nếu có)

## Các bước kết nối

### 1. Mở SSMS và nhập thông tin

Trong cửa sổ "Connect to Server":
- **Server type**: Database Engine
- **Server name**: `localhost,1434` (phải có dấu phẩy và port)
- **Authentication**: SQL Server Authentication
- **Login**: `sa`
- **Password**: `Passw0rd123!`

### 2. Cấu hình Connection Properties (QUAN TRỌNG)

Click **"Options >>"** hoặc tab **"Connection Properties"**:

- **Encrypt**: **"Optional"** hoặc **"Off"** (KHÔNG dùng "Mandatory")
- **Trust Server Certificate**: ✅ Check (bật)
- **Connect to database**: Chọn `master` từ dropdown (KHÔNG để `<default>`)

> **Lưu ý:** Nếu thấy "Encrypt: Mandatory", đây là nguyên nhân gây lỗi "Login failed"!

### 3. Kết nối

Click **Connect**. Sau khi thành công, expand "Databases" trong Object Explorer để xem `flight_booking_db`.

## Troubleshooting

### Lỗi: "Cannot connect to localhost,1434"

**Nguyên nhân:** Container chưa chạy hoặc chưa sẵn sàng.

**Giải pháp:**
```bash
docker-compose ps sqlserver  # Kiểm tra status
docker-compose logs sqlserver  # Đợi "SQL Server is ready"
docker-compose restart sqlserver  # Restart nếu cần
```

### Lỗi: "Login failed for user 'sa'" (Error 18456)

**Nguyên nhân:** Encryption setting sai, password sai, hoặc thiếu Initial Catalog.

**Giải pháp:**

1. **Test password bằng command line:**
   ```bash
   docker exec sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Passw0rd123!" -C -Q "SELECT @@VERSION"
   ```
   Nếu thành công → password đúng, vấn đề ở SSMS settings.

2. **Sửa Connection Properties:**
   - **Encrypt**: Đổi từ "Mandatory" sang **"Optional"** hoặc **"Off"**
   - **Trust Server Certificate**: ✅ Check
   - **Connect to database**: Chọn `master` (KHÔNG để `<default>`)

3. **Kiểm tra password:** `Passw0rd123!` (chữ P viết hoa, số 0, có dấu chấm than)

4. **Restart container:**
   ```bash
   docker-compose restart sqlserver
   ```
   Đợi 30-60 giây rồi thử lại.

5. **Reset hoàn toàn (nếu vẫn không được):**
   ```bash
   docker-compose down -v
   docker-compose up -d sqlserver
   ```
   **CẢNH BÁO:** Lệnh này sẽ xóa tất cả dữ liệu!

### Lỗi: "A network-related or instance-specific error"

**Nguyên nhân:** Port chưa được expose hoặc bị block.

**Giải pháp:**
- Kiểm tra port mapping trong `docker-compose.yml` hoặc `docker-compose-full-services.yml`: `"1434:1433"`
- Kiểm tra port đã được dùng: `netstat -ano | findstr :1434` (Windows)
- Kiểm tra Windows Firewall

## Sau khi kết nối thành công

### Xem databases
Expand "Databases" → Tìm `flight_booking_db` → Expand để xem tables, views, etc.

### Chạy queries
1. Click "New Query"
2. Chọn database `flight_booking_db` từ dropdown
3. Viết và chạy SQL queries

### Ví dụ query

```sql
-- Xem tất cả tables
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;

-- Xem migrations đã chạy
SELECT * FROM migrations ORDER BY timestamp DESC;
```

## Quick Reference

**Thông tin kết nối:**
- Server: `localhost,1434`
- Login: `sa`
- Password: `Passw0rd123!`
- Database: `master` (khi kết nối) → `flight_booking_db` (sau khi kết nối)

**Lệnh kiểm tra:**
```bash
docker-compose ps sqlserver
docker-compose logs sqlserver
```

> **Lưu ý:** Password `Passw0rd123!` chỉ dùng cho Docker development, không dùng cho production.
