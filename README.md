# Flight Booking Backend

Backend cho hệ thống đặt vé máy bay nội địa Việt Nam, sử dụng NestJS với Microservices Architecture.

## Yêu cầu

- **Node.js**: v18.x+ (nếu chạy local)
- **npm**: v9.x+ (nếu chạy local)
- **SQL Server**: 2019+ (Local hoặc Azure) - hoặc dùng Docker
- **Docker**: Để chạy toàn bộ hệ thống hoặc chỉ Redis
- **Git**: Để clone repository

## Cài đặt nhanh

### Option 1: Chạy bằng Docker (Khuyến nghị cho FE Developer)

Cách đơn giản nhất để chạy toàn bộ hệ thống:

```bash
# Clone repository
git clone <repository-url>
cd be-flight-booking

# Chạy toàn bộ hệ thống (SQL Server + Redis + Backend + Seed DB)
docker-compose up --build
```

Hệ thống sẽ tự động:
- Tạo database và user
- Chạy schema SQL
- Seed database với dữ liệu mẫu
- Khởi động tất cả services

**Xem chi tiết:** [Docker Setup Guide](./docker/README.md)

### Option 2: Chạy local (Manual Setup)

### 1. Clone và cài đặt dependencies

```bash
git clone <repository-url>
cd be-flight-booking
npm install
```

### 2. Setup Database

**Tạo database và user:**
1. Mở SQL Server Management Studio (SSMS)
2. Kết nối với user `sa` (hoặc user có quyền sysadmin)
3. Tạo database: `CREATE DATABASE flight_booking_db;`
4. Tạo login và user:
   ```sql
   USE master;
   CREATE LOGIN maxnoah WITH PASSWORD = '12341234';
   USE flight_booking_db;
   CREATE USER maxnoah FOR LOGIN maxnoah;
   ALTER ROLE db_owner ADD MEMBER maxnoah;
   ```

**Tạo schema:**
1. Kết nối với database `flight_booking_db`
2. Chạy script: `sql/schema/flight_booking_db.sql`

**Lưu ý:** Schema không dùng `DEFAULT NEWSEQUENTIALID()`. Tất cả IDs phải được generate từ application code (UUID v7).

### 3. Setup Environment Variables

Copy `env.example` thành `.env` và cấu hình:

```env
# Database
DB_HOST=localhost
DB_PORT=1433
DB_USER=maxnoah
DB_PASS=12341234
DB_NAME=flight_booking_db
DB_ENCRYPT=false
DB_TRUST_CERT=true

# API Gateway
PORT=3000

# JWT
JWT_ACCESS_SECRET=c769850ee4f001088ba440c3211390099dbb7f9e2e0593be9233e395dce6e931
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_SECRET=1bbf355aefde63bd595ec266351544354991b215124ed1b88ab7c8ef92f876d8
JWT_REFRESH_EXPIRES=7d

# Microservices
SEARCH_MS_HOST=127.0.0.1
SEARCH_MS_PORT=4001
SERVICES_MS_HOST=127.0.0.1
SERVICES_MS_PORT=4002
ROUTES_MS_HOST=127.0.0.1
ROUTES_MS_PORT=4003
BOOKING_MS_HOST=127.0.0.1
BOOKING_MS_PORT=4004
RESERVATION_MS_HOST=127.0.0.1
RESERVATION_MS_PORT=4005

# Redis (Required for Reservation Service)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_KEY_PREFIX=flight-booking:
REDIS_RESERVATION_TTL=900
```

### 4. Setup Redis

```bash
docker-compose up -d redis
```

Hoặc chạy trực tiếp:
```bash
docker run -d --name flight-booking-redis -p 6379:6379 redis:7-alpine
```

Kiểm tra: `docker exec -it flight-booking-redis redis-cli ping` (should return: PONG)

### 5. Seed Database

```bash
npm run seed:full
```

Script này tạo hàng ngàn records (users, flights, bookings, etc.) cho 60 ngày tới. Có thể chạy 15-45 phút.

**Lưu ý:** Tất cả users có password mặc định: `Password123!`

### 6. Chạy Backend

**Development Mode (Recommended):**

Mở 6 terminals:

```bash
# Terminal 1 - API Gateway
npm run start:dev

# Terminal 2 - Search Microservice
npm run start:search:dev

# Terminal 3 - Services Microservice (Optional)
npm run start:services:dev

# Terminal 4 - Routes Microservice (Optional)
npm run start:routes:dev

# Terminal 5 - Booking Microservice
npm run start:booking:dev

# Terminal 6 - Reservation Microservice
npm run start:reservation:dev
```

**Production Mode:**

```bash
npm run build
npm run start:prod        # API Gateway
npm run start:search      # Search MS
npm run start:services    # Services MS
npm run start:routes      # Routes MS
npm run start:booking     # Booking MS
npm run start:reservation # Reservation MS
```

## Kiểm tra cài đặt

1. **Swagger UI**: `http://localhost:3000/api-docs`
2. **Test Search API**:
   ```bash
   curl "http://localhost:3000/search/flights?origin=HAN&destination=SGN&departDate=2025-11-18&tripType=one_way&adults=1&minors=0"
   ```
3. **Test Auth**:
   ```bash
   # Register
   curl -X POST http://localhost:3000/auth/register \
     -H "Content-Type: application/json" \
     -d '{"fullname":"Test User","email":"test@example.com","password":"Test123456","phone":"0901234567"}'
   
   # Login
   curl -X POST http://localhost:3000/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"Test123456"}'
   ```

## Booking Flow (Recommended)

1. **Search Flights**: `GET /search/flights`
2. **Get Fare Options**: `GET /search/fare-options?flightInstanceId=xxx&cabinType=economy`
3. **Create Reservation**: `POST /reservations` (lưu `reservationId`)
4. **Create Booking from Reservation**: `POST /bookings?reservationId=xxx`
5. **Get Booking Details**: `GET /bookings/:id/fare-details`, `GET /bookings/:id/payment-info`

**Lưu ý:** Reservation tự động expire sau 15 phút và được cancel sau khi tạo booking thành công.

## Scripts

| Script | Mô tả |
|--------|-------|
| `npm run start:dev` | API Gateway (dev mode) |
| `npm run start:search:dev` | Search Microservice (dev mode) |
| `npm run start:services:dev` | Services Microservice (dev mode) |
| `npm run start:routes:dev` | Routes Microservice (dev mode) |
| `npm run start:booking:dev` | Booking Microservice (dev mode) |
| `npm run start:reservation:dev` | Reservation Microservice (dev mode) |
| `npm run seed:full` | Seed full database |
| `npm run build` | Build project |
| `npm run test:db` | Test database connection |

## Cấu trúc Project

```
src/
├── api-gateway/         # REST API (port 3000)
├── microservices/       # Microservices (TCP)
│   ├── search/          # Port 4001
│   ├── services/        # Port 4002
│   ├── routes/          # Port 4003
│   ├── booking/         # Port 4004
│   └── reservation/     # Port 4005 (Redis-based)
├── shared/              # Entities, types, config
└── scripts/             # Seed scripts
```

## Documentation

Tất cả tài liệu trong thư mục [`docs/`](./docs/):

- **[API Documentation](./docs/api/)** - API endpoints và flow analysis
- **[Database Documentation](./docs/database/)** - Setup, SQL scripts, ERD
- **[Setup Guides](./docs/setup/)** - Redis, WSL, troubleshooting
- **[Design Documents](./docs/design/)** - Microservices design

**Swagger UI**: `http://localhost:3000/api-docs`

## Troubleshooting

### "Login failed for user 'maxnoah'"

1. Tạo database và user (xem hướng dẫn ở Bước 2)
2. Kiểm tra SQL Server Authentication đã bật (Mixed Mode)
3. Test connection: `npm run test:db` hoặc chạy `sql/utils/test-connection.sql`

### "Redis connection failed"

1. Chạy Redis: `docker-compose up -d redis`
2. Kiểm tra: `docker ps | grep redis`
3. Test: `docker exec -it flight-booking-redis redis-cli ping`

### "Microservice connection failed"

Đảm bảo microservice tương ứng đã chạy:
- Search: `npm run start:search:dev`
- Booking: `npm run start:booking:dev`
- Reservation: `npm run start:reservation:dev` (cần Redis)

## Tech Stack

- **Framework**: NestJS 11.x
- **Database**: Microsoft SQL Server
- **ORM**: TypeORM
- **Cache**: Redis (Reservation Service)
- **Authentication**: JWT (Passport)
- **API Docs**: Swagger/OpenAPI
- **Microservices**: TCP-based communication

## Features

- **Microservices Architecture**: Tách biệt Search, Services, Routes, Booking, Reservation
- **Backend-managed State**: Reservation Service quản lý state trong Redis
- **UUID v7**: Tất cả IDs sử dụng UUID v7 (time-ordered)
- **JWT Authentication**: Tự động extract userId từ token
- **Passenger Creation**: Tự động tạo passenger khi booking
- **Transaction Safety**: Booking creation với transaction rollback
