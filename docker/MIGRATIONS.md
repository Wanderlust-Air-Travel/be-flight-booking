# Chạy Migrations trong Docker

## Tự động chạy migrations

Khi chạy `docker-compose up --build`, migrations sẽ **tự động chạy** thông qua script `docker/init-database.js`:

```bash
docker-compose up --build
```

Quá trình sẽ:
1. Tạo database và user
2. **Chạy migrations tự động** (tạo tables, indexes, triggers)
3. Seed database (nếu có)
4. Khởi động services

## Chạy migrations thủ công

### 1. Chạy migrations trong container đang chạy

```bash
# Vào container backend
docker-compose exec backend sh

# Chạy migrations
npm run migration:run

# Hoặc dùng TypeORM CLI trực tiếp
npx typeorm-ts-node-commonjs migration:run -d dist/shared/config/typeorm.js
```

### 2. Chạy migrations từ bên ngoài container

```bash
# Chạy migration command trong container
docker-compose exec backend npm run migration:run
```

### 3. Xem trạng thái migrations

```bash
# Xem migrations đã chạy
docker-compose exec backend npm run migration:show

# Hoặc kiểm tra trực tiếp trong database
docker-compose exec sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Passw0rd123!" -C -d flight_booking_db -Q "SELECT * FROM migrations"
```

### 4. Revert migration (rollback)

```bash
# Revert migration gần nhất
docker-compose exec backend npm run migration:revert
```

## Tạo migration mới

### Từ local machine (khuyến nghị)

```bash
# Tạo migration từ entities (auto-generate)
npm run migration:generate src/migrations/MigrationName

# Tạo migration trống (manual)
npm run migration:create src/migrations/MigrationName
```

Sau đó rebuild Docker:

```bash
docker-compose up --build
```

### Từ trong container (không khuyến nghị)

```bash
docker-compose exec backend npm run migration:generate src/migrations/MigrationName
```

## Kiểm tra migrations đã chạy

### Cách 1: Xem bảng migrations trong database

```bash
# Kết nối vào SQL Server container
docker-compose exec sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Passw0rd123!" -C -d flight_booking_db -Q "SELECT * FROM migrations ORDER BY timestamp DESC"
```

### Cách 2: Xem logs khi container khởi động

```bash
# Xem logs của backend container
docker-compose logs backend | grep -i migration
```

### Cách 3: Dùng TypeORM CLI

```bash
docker-compose exec backend npm run migration:show
```

## Troubleshooting

### Migrations không chạy

1. **Kiểm tra migrations đã được compile chưa:**
   ```bash
   docker-compose exec backend ls -la dist/shared/migrations/
   ```

2. **Kiểm tra TypeORM config:**
   ```bash
   docker-compose exec backend cat dist/shared/config/typeorm.js
   ```

3. **Chạy migrations thủ công để xem lỗi:**
   ```bash
   docker-compose exec backend npm run migration:run
   ```

### Migration bị lỗi

1. **Xem logs chi tiết:**
   ```bash
   docker-compose logs backend
   ```

2. **Kiểm tra database connection:**
   ```bash
   docker-compose exec backend npm run test:db
   ```

3. **Revert migration lỗi:**
   ```bash
   docker-compose exec backend npm run migration:revert
   ```

### Reset database và chạy lại migrations

```bash
# Xóa volumes (xóa toàn bộ data)
docker-compose down -v

# Khởi động lại (migrations sẽ chạy lại từ đầu)
docker-compose up --build
```

## Lưu ý

- Migrations chỉ chạy **một lần** cho mỗi migration
- TypeORM lưu trạng thái migrations trong bảng `migrations` trong database
- Không sửa migrations đã chạy, chỉ tạo migration mới
- Luôn test migrations trên database dev trước khi deploy production

