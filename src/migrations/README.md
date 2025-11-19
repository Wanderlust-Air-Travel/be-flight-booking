# TypeORM Migrations

Thư mục chứa các migration files cho database schema.

## Cấu trúc

- `1700000000000-InitialSchema.ts` - Migration ban đầu tạo toàn bộ database schema
- `1734567890000-AddReservationsTable.ts` - Migration thêm bảng Reservations (Hybrid Approach: Database + Redis)
- `1734600000000-UpdatePaymentTables.ts` - Migration update Payment và PaymentMethod tables (Phase 1 & 2 improvements)
  - Add `is_active BIT NOT NULL DEFAULT 1` to PaymentMethods table
  - Add `idempotency_key VARCHAR(100) NULL` to Payments table
  - Add `expires_at DATETIME2 NULL` to Payments table
  - Create indexes: `IX_Payments_IdempotencyKey`, `IX_Payments_ExpiresAt`

## Cách sử dụng

### Chạy migrations

```bash
# Chạy tất cả pending migrations
npm run migration:run

# Xem trạng thái migrations
npm run migration:show

# Revert migration gần nhất
npm run migration:revert
```

### Tạo migration mới

```bash
# Tạo migration từ entities (auto-generate)
npm run migration:generate src/migrations/MigrationName

# Tạo migration trống (manual)
npm run migration:create src/migrations/MigrationName
```

### Trong Docker

Migrations sẽ tự động chạy khi khởi động Docker container thông qua script `docker/init-database.ts`.

## Lưu ý

- Tất cả migrations phải được viết theo format TypeORM
- Migration files phải có timestamp prefix (ví dụ: `1700000000000-`)
- Không sửa migrations đã chạy, chỉ tạo migration mới để thay đổi schema
- Migrations được lưu trong bảng `migrations` trong database

