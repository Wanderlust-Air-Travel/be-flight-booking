# Docker Database Initialization Flow

Tài liệu mô tả chi tiết flow khởi tạo database trong Docker environment.

## Tổng quan

Hệ thống sử dụng 3 scripts riêng biệt để đảm bảo database được khởi tạo đúng cách và tránh race conditions:

1. **`wait-for-sqlserver.ts`** - Chờ SQL Server sẵn sàng
2. **`init-database.ts`** - Tạo database và chạy migrations
3. **`wait-for-database.ts`** - Verify database cụ thể sẵn sàng

## Flow chi tiết

```
┌─────────────────────────────────────────────────────────────┐
│  docker-compose.development.yml command
│  wait-for-sqlserver → init-db → wait-for-db → seed → start │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  1. wait-for-sqlserver.ts                                   │
│  - Kết nối với 'master' database                            │
│  - Verify SQL Server instance sẵn sàng                      │
│  - Retry: 30 attempts, mỗi 2 giây                          │
│  - Exit: 0 nếu thành công, 1 nếu fail                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  2. init-database.ts                                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  a. createDatabase()                                  │   │
│  │     - Kết nối 'master' database                      │   │
│  │     - CREATE DATABASE flight_booking_db              │   │
│  │     - Wait 5 giây để database finalize               │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  b. runMigrations()                                   │   │
│  │     - Kết nối flight_booking_db                      │   │
│  │     - Chạy TypeORM migrations                        │   │
│  │     - Exit 1 nếu fail                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  c. verifyDatabase()                                  │   │
│  │     - Kết nối flight_booking_db                      │   │
│  │     - SELECT 1 để verify                             │   │
│  │     - Exit 1 nếu fail                                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. wait-for-database.ts                                    │
│  - Kết nối với 'flight_booking_db' database                 │
│  - Verify database sẵn sàng và accessible                   │
│  - Retry: 30 attempts, mỗi 2 giây                          │
│  - Exit: 0 nếu thành công, 1 nếu fail                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  4. seed-db (optional)                                      │
│  - Seed dữ liệu mẫu vào database                            │
│  - Continue nếu fail (|| true)                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  5. start-all.ts                                            │
│  - Wait 10 giây để đảm bảo database hoàn toàn sẵn sàng     │
│  - Start tất cả microservices                              │
│  - Start API Gateway                                        │
└─────────────────────────────────────────────────────────────┘
```

## Scripts chi tiết

### 1. wait-for-sqlserver.ts

**Mục đích:** Chờ SQL Server instance sẵn sàng trước khi tạo database

**Logic:**
- Kết nối với `master` database (luôn tồn tại)
- Không sử dụng `DB_NAME` vì database có thể chưa tồn tại
- Retry 30 lần, mỗi 2 giây
- Exit code 0 nếu thành công, 1 nếu fail

**Khi nào dùng:**
- Trước khi chạy `init-database.ts`
- Đảm bảo SQL Server đã khởi động hoàn toàn

### 2. init-database.ts

**Mục đích:** Tạo database và chạy migrations

**Các bước:**

1. **createDatabase()**
   - Kết nối với `master` database
   - Tạo `flight_booking_db` nếu chưa tồn tại
   - Wait 5 giây để SQL Server finalize database creation

2. **runMigrations()**
   - Kết nối với `flight_booking_db`
   - Chạy TypeORM migrations
   - Exit 1 nếu fail (không chỉ warning)

3. **verifyDatabase()**
   - Kết nối với `flight_booking_db`
   - Thực hiện `SELECT 1` để verify
   - Exit 1 nếu fail

**Exit codes:**
- 0: Thành công
- 1: Fail ở bất kỳ bước nào

### 3. wait-for-database.ts

**Mục đích:** Verify database cụ thể sẵn sàng sau khi đã tạo

**Logic:**
- Kết nối với `flight_booking_db` (database đã được tạo)
- Retry 30 lần, mỗi 2 giây
- Log mỗi 5 attempts để giảm noise
- Exit code 0 nếu thành công, 1 nếu fail

**Khi nào dùng:**
- Sau khi chạy `init-database.ts`
- Đảm bảo database sẵn sàng trước khi start services

### 4. start-all.ts

**Mục đích:** Khởi động tất cả services

**Logic:**
- Wait 10 giây để đảm bảo database hoàn toàn sẵn sàng
- Start tất cả microservices (Search, Services, Routes, Booking, Reservation, Payment, Email)
- Wait 3 giây
- Start API Gateway

**Lưu ý:**
- Delay 10 giây trước khi start services để tránh race condition
- Services sẽ cố kết nối database ngay khi khởi động (TypeORM)

## Environment Variables

Các script sử dụng environment variables từ `.env` hoặc `docker-compose.development.yml`:

- `DB_HOST` - SQL Server host (default: `sqlserver` trong Docker, `localhost` local)
- `DB_PORT` - SQL Server port (default: `1433` trong Docker, `1434` local)
- `DB_USER` - Database user (default: `sa`)
- `DB_PASS` - Database password (from .env file, no hardcoded default)
- `DB_NAME` - Database name (default: `flight_booking_db`)
- `SA_PASSWORD` - SA password (fallback nếu `DB_PASS` không có)

## Troubleshooting

### Lỗi "Login failed for user 'sa'. Reason: Failed to open the explicitly specified database 'flight_booking_db'"

**Nguyên nhân:**
- Services cố kết nối với database trước khi database được tạo
- Race condition giữa database creation và service startup

**Giải pháp:**
1. Rebuild containers để đảm bảo flow đúng:
   ```bash
   docker-compose down -v
   docker-compose up --build
   ```

2. Kiểm tra logs để verify flow:
   ```bash
   docker-compose logs backend | grep -E "(SQL Server is ready|Database.*ready|init-database)"
   ```

3. Đảm bảo scripts chạy đúng thứ tự:
   - `wait-for-sqlserver` → `init-db` → `wait-for-db` → `seed-db` → `start:all`

### Database không được tạo

**Kiểm tra:**
```bash
docker-compose logs backend | grep -E "(Creating database|Database created|init-database)"
```

**Nếu không thấy "Database created":**
- Kiểm tra SQL Server logs: `docker-compose logs sqlserver`
- Verify SA password đúng
- Kiểm tra permissions

### Migrations không chạy

**Kiểm tra:**
```bash
docker-compose logs backend | grep -E "(Running TypeORM migrations|migration)"
```

**Nếu migrations fail:**
- Kiểm tra migration files có trong `dist/shared/migrations/`
- Verify database connection string
- Check migration syntax

## Best Practices

1. **Luôn dùng `wait-for-sqlserver` trước `init-db`**
   - Đảm bảo SQL Server sẵn sàng
   - Tránh kết nối với database chưa tồn tại

2. **Luôn verify database sau migrations**
   - Đảm bảo database sẵn sàng
   - Tránh services kết nối database chưa hoàn toàn ready

3. **Delay trước khi start services**
   - Cho database thời gian finalize
   - Tránh race conditions

4. **Exit codes**
   - Scripts phải exit với code đúng (0 = success, 1 = fail)
   - Docker compose sẽ dừng nếu script fail

5. **Logging**
   - Log rõ ràng từng bước
   - Log errors với context
   - Giảm noise (log mỗi 5 attempts thay vì mỗi attempt)

## Related Files

- `docker/wait-for-sqlserver.ts` - Wait for SQL Server
- `docker/init-database.ts` - Initialize database
- `docker/wait-for-database.ts` - Wait for specific database
- `docker/start-all.ts` - Start all services
- `docker-compose.development.yml` - Docker compose configuration

