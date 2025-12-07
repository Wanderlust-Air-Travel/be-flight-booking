# Hướng dẫn chạy Backend Local với Docker Services

Hướng dẫn này giúp bạn chạy backend code ở local trong khi các services (MSSQL, Redis, RabbitMQ) chạy trong Docker.

## 📋 Yêu cầu

1. Docker Desktop đã được cài đặt và chạy
2. Node.js và npm đã được cài đặt
3. File `.env` đã được cấu hình (xem bên dưới)

## 🚀 Các bước setup

### Bước 1: Cấu hình file `.env`

Đảm bảo file `.env` trong thư mục `be-flight-booking/` có các cấu hình sau để kết nối với Docker services:

```env
# Database - Kết nối đến Docker SQL Server
DB_HOST=localhost
DB_PORT=1434          # Port host được map từ Docker (1434:1433)
DB_USER=sa
DB_PASS=Passw0rd123!
DB_NAME=flight_booking_db
DB_ENCRYPT=false
DB_TRUST_CERT=true
SA_PASSWORD=Passw0rd123!

# Redis - Kết nối đến Docker Redis
REDIS_HOST=localhost  # Kết nối từ localhost vì Docker expose port 6379
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_KEY_PREFIX=flight-booking:

# RabbitMQ - Kết nối đến Docker RabbitMQ
RABBITMQ_HOST=localhost  # Kết nối từ localhost vì Docker expose port 5672
RABBITMQ_PORT=5672
RABBITMQ_USER=admin
RABBITMQ_PASS=admin123
RABBITMQ_VHOST=/
```

### Bước 2: Chạy Docker Services

Chạy chỉ các services (MSSQL, Redis, RabbitMQ) trong Docker:

```bash
cd be-flight-booking
docker compose -f docker-compose.services.yml up -d
```

Kiểm tra services đã chạy:

```bash
docker compose -f docker-compose.services.yml ps
```

### Bước 3: Setup Database và Environment

Chạy script setup để:
- Đợi SQL Server và RabbitMQ sẵn sàng
- Tạo database và chạy migrations
- Seed data nếu database rỗng
- Authenticate Gmail (optional)

```bash
npm run setup:local
```

Hoặc chạy từng bước thủ công:

```bash
# 1. Đợi SQL Server
npm run wait-for-sqlserver

# 2. Đợi RabbitMQ
npm run wait-for-rabbitmq

# 3. Khởi tạo database (create DB + migrations)
npm run init-db

# 4. Đợi database sẵn sàng
npm run wait-for-db

# 5. Seed data nếu database rỗng
npm run seed:if-empty

# 6. Authenticate Gmail (optional)
npm run gmail:auth
```

### Bước 4: Build và chạy Application

**Option 1: Chạy tất cả services (production-like)**

```bash
# Build trước
npm run build

# Sau đó chạy tất cả (API Gateway + tất cả microservices)
npm run start:all
```

**Option 2: Chạy từng service riêng (development mode)**

```bash
# Terminal 1: API Gateway
npm run start:dev

# Terminal 2: Search Microservice
npm run start:search:dev

# Terminal 3: Services Microservice
npm run start:services:dev

# Terminal 4: Routes Microservice
npm run start:routes:dev

# Terminal 5: Booking Microservice
npm run start:booking:dev

# Terminal 6: Reservation Microservice
npm run start:reservation:dev

# Terminal 7: Payment Microservice
npm run start:payment:dev

# Terminal 8: Email Microservice
npm run start:email:dev
```

**Option 3: Setup + Start tất cả trong một lệnh**

```bash
npm run dev:setup
```

Lệnh này sẽ:
1. Chạy setup (wait-for, init-db, seed, etc.)
2. Build application
3. Start tất cả services

## 📝 Scripts có sẵn

| Script | Mô tả |
|--------|-------|
| `npm run setup:local` | Chạy tất cả các bước setup (wait-for, init-db, seed, gmail-auth) |
| `npm run dev:setup` | Setup + Build + Start tất cả services |
| `npm run wait-for-sqlserver` | Đợi SQL Server sẵn sàng |
| `npm run wait-for-rabbitmq` | Đợi RabbitMQ sẵn sàng |
| `npm run wait-for-db` | Đợi database được tạo và sẵn sàng |
| `npm run init-db` | Tạo database + chạy migrations |
| `npm run seed:if-empty` | Seed data nếu database rỗng |
| `npm run gmail:auth` | Authenticate Gmail (optional) |
| `npm run start:all` | Start tất cả services (API Gateway + Microservices) |
| `npm run start:dev` | Start API Gateway (watch mode) |
| `npm run start:search:dev` | Start Search microservice (watch mode) |

## 🔍 Troubleshooting

### Lỗi kết nối SQL Server

- Kiểm tra Docker container đang chạy: `docker ps`
- Kiểm tra port mapping: `docker compose -f docker-compose.services.yml ps`
- Test kết nối: `npm run test:db`
- Đảm bảo `DB_HOST=localhost` và `DB_PORT=1434` trong `.env`

### Lỗi kết nối Redis

- Kiểm tra Redis container: `docker ps | grep redis`
- Test kết nối: `docker exec -it redis redis-cli ping`
- Đảm bảo `REDIS_HOST=localhost` và `REDIS_PORT=6379` trong `.env`

### Lỗi kết nối RabbitMQ

- Kiểm tra RabbitMQ container: `docker ps | grep rabbitmq`
- Truy cập Management UI: http://localhost:15672 (admin/admin123)
- Đảm bảo `RABBITMQ_HOST=localhost` và `RABBITMQ_PORT=5672` trong `.env`

### Database chưa được tạo

- Chạy lại: `npm run init-db`
- Kiểm tra logs: Xem output của script `init-db`
- Xóa và tạo lại database nếu cần

## 🛑 Dừng Services

```bash
# Dừng Docker services
docker compose -f docker-compose.services.yml down

# Nếu muốn xóa cả volumes (mất data)
docker compose -f docker-compose.services.yml down -v
```

## 📚 Thông tin kết nối

- **MSSQL**: `localhost:1434` (SA password: `Passw0rd123!`)
- **Redis**: `localhost:6379`
- **RabbitMQ Management UI**: http://localhost:15672 (user: `admin`, password: `admin123`)
- **RabbitMQ AMQP**: `localhost:5672`

## 💡 Tips

1. **Lần đầu chạy**: Luôn chạy `npm run setup:local` trước
2. **Chỉ thay đổi code**: Không cần chạy setup lại, chỉ cần restart service
3. **Thay đổi database schema**: Chạy lại `npm run init-db` để apply migrations
4. **Reset database**: Dừng Docker services và xóa volumes, sau đó chạy lại setup

