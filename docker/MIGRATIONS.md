# Chạy Migrations trong Docker

## Tự động chạy migrations

Khi chạy `npm run docker:infra:up && npm run docker:dev:up`, migrations sẽ **tự động chạy** thông qua script `docker/init-database.ts` được gọi bởi `npm run docker:init-db`:

```bash
npm run docker:infra:up
npm run docker:dev:up
```

Quá trình sẽ:
1. Tạo database (sử dụng user `sa` với password `Strong!Pass1234`)
2. **Chạy migrations tự động** (tạo tables, indexes, triggers)
   - TypeORM DataSource được tạo trực tiếp từ environment variables
   - Không cần file `.env` trong container (env vars từ `docker-compose.development.yml` và `docker-compose.infrastructure.yml`)
   - Tất cả truy cập database đều dùng user `sa`
3. Seed database (nếu có)
4. Khởi động services

**Lưu ý:** Script `init-database.ts` (TypeScript) đã được cập nhật để:
- Sử dụng TypeScript với type safety và code chuẩn NestJS
- Tạo DataSource trực tiếp từ environment variables (không dùng file config)
- Thêm delay sau khi update password để đảm bảo thay đổi được commit
- Tự động retry nếu migrations gặp lỗi tạm thời
- Chạy bằng `ts-node` thay vì `node` (TypeScript runtime)

## Chạy migrations thủ công

### 1. Chạy migrations trong container đang chạy

```bash
# Vào container backend
docker compose -f docker-compose.infrastructure.yml -f docker-compose.development.yml exec api-gateway sh

# Chạy migrations
npm run migration:run

# Hoặc dùng TypeORM CLI trực tiếp
npx typeorm-ts-node-commonjs migration:run -d dist/shared/config/typeorm.js
```

### 2. Chạy migrations từ bên ngoài container

```bash
# Chạy migration command trong container
docker compose -f docker-compose.infrastructure.yml -f docker-compose.development.yml exec api-gateway npm run migration:run
```

### 3. Xem trạng thái migrations

```bash
# Xem migrations đã chạy
docker compose -f docker-compose.infrastructure.yml -f docker-compose.development.yml exec api-gateway npm run migration:show

# Hoặc kiểm tra trực tiếp trong database (từ trong container)
docker compose -f docker-compose.infrastructure.yml -f docker-compose.development.yml exec sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Strong!Pass1234" -C -d flight_booking_db -Q "SELECT * FROM migrations"

# Hoặc từ host (nếu có sqlcmd)
sqlcmd -S localhost,1434 -U sa -P "Strong!Pass1234" -C -d flight_booking_db -Q "SELECT * FROM migrations"
```

### 4. Revert migration (rollback)

```bash
# Revert migration gần nhất
docker compose -f docker-compose.infrastructure.yml -f docker-compose.development.yml exec api-gateway npm run migration:revert
```

## Tạo migration mới

### Từ local machine (khuyến nghị)

```bash
# Tạo migration từ entities (auto-generate)
npm run migration:generate -- src/migrations/MigrationName
```

Nếu cần migration trống, dùng TypeORM CLI trực tiếp thay vì npm script riêng:

```bash
npx typeorm-ts-node-commonjs migration:create src-nestjs/shared/migrations/MigrationName
```

Sau đó rebuild Docker:

```bash
npm run docker:dev:down && npm run docker:dev:build && npm run docker:dev:up
```

**Lưu ý:** Cần rebuild sau khi tạo migration mới vì migrations được compile vào `dist/`.

### Từ trong container (không khuyến nghị)

```bash
docker compose -f docker-compose.infrastructure.yml -f docker-compose.development.yml exec api-gateway npm run migration:generate -- src-nestjs/shared/migrations/MigrationName
```

## Kiểm tra migrations đã chạy

### Cách 1: Xem bảng migrations trong database

```bash
# Kết nối vào SQL Server container
docker compose -f docker-compose.infrastructure.yml -f docker-compose.development.yml exec sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Strong!Pass1234" -C -d flight_booking_db -Q "SELECT * FROM migrations ORDER BY timestamp DESC"
```

### Cách 2: Xem logs khi container khởi động

```bash
# Xem logs của api-gateway container
docker compose -f docker-compose.infrastructure.yml -f docker-compose.development.yml logs api-gateway | grep -i migration
```

### Cách 3: Dùng TypeORM CLI

```bash
docker compose -f docker-compose.infrastructure.yml -f docker-compose.development.yml exec api-gateway npm run migration:show
```

## Troubleshooting

### Migrations không chạy

1. **Kiểm tra migrations đã được compile chưa:**
   ```bash
   docker compose -f docker-compose.infrastructure.yml -f docker-compose.development.yml exec api-gateway ls -la dist/shared/migrations/
   ```

2. **Kiểm tra TypeORM config:**
   ```bash
   docker compose -f docker-compose.infrastructure.yml -f docker-compose.development.yml exec api-gateway cat dist/shared/config/typeorm.js
   ```

3. **Chạy migrations thủ công để xem lỗi:**
   ```bash
   docker compose -f docker-compose.infrastructure.yml -f docker-compose.development.yml exec api-gateway npm run migration:run
   ```

### Migration bị lỗi

1. **Xem logs chi tiết:**
   ```bash
   docker compose -f docker-compose.infrastructure.yml -f docker-compose.development.yml logs api-gateway
   ```

### Migration bị lỗi

1. **Xem logs chi tiết:**
   ```bash
   docker compose -f docker-compose.infrastructure.yml -f docker-compose.development.yml logs api-gateway
   ```

2. **Kiểm tra database connection:**
   - Verify lại biến môi trường kết nối DB trong container (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`)
   - Có thể kiểm tra nhanh bằng cách chạy lại `npm run migration:show`

2. **Kiểm tra database connection:**
   - Verify lại biến môi trường kết nối DB trong container (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`)
   - Có thể kiểm tra nhanh bằng cách chạy lại `npm run migration:show`

3. **Revert migration lỗi:**
   ```bash
   docker compose -f docker-compose.infrastructure.yml -f docker-compose.development.yml exec api-gateway npm run migration:revert
   ```

### Reset database và chạy lại migrations

```bash
# Xóa volumes (xóa toàn bộ data)
docker compose -f docker-compose.infrastructure.yml -f docker-compose.development.yml down -v

# Khởi động lại (migrations sẽ chạy lại từ đầu)
npm run docker:dev:up
```

## Lưu ý

- Migrations chỉ chạy **một lần** cho mỗi migration
- TypeORM lưu trạng thái migrations trong bảng `migrations` trong database
- Không sửa migrations đã chạy, chỉ tạo migration mới
- Luôn test migrations trên database dev trước khi deploy production

