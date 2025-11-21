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
docker-compose -f docker-compose-full-services.yml up --build
```

Hệ thống sẽ tự động:
- Tạo database và user
- **Chạy TypeORM migrations** (tạo tables, indexes, triggers) qua script TypeScript `docker/init-database.ts`
- Seed database với dữ liệu mẫu
- Khởi động tất cả services

**Xem chi tiết:** 
- [Docker Setup Guide](./docker/README.md) - Tổng quan về Docker setup
- [Hướng dẫn chạy Full Services](./docker/HOW_TO_RUN.md) - Hướng dẫn chi tiết từng bước

### Option 2: Chạy local (Manual Setup)

### 1. Clone và cài đặt dependencies

```bash
git clone <repository-url>
cd be-flight-booking
npm install
```

### 2. Setup Database

**Tạo database:**
1. Mở SQL Server Management Studio (SSMS)
2. Kết nối với user `sa` (password mặc định: `12341234` hoặc password bạn đã đặt)
3. Tạo database: `CREATE DATABASE flight_booking_db;`

**Chạy migrations:**
1. Kết nối với database `flight_booking_db`
2. Chạy TypeORM migrations: `npm run migration:run`

**Lưu ý:** Schema không dùng `DEFAULT NEWSEQUENTIALID()`. Tất cả IDs phải được generate từ application code (UUID v7).

## Cấu trúc Project

```
src/
├── api-gateway/         # REST API (port 3000)
├── microservices/       # Microservices (TCP)
│   ├── search/          # Port 4001
│   ├── services/        # Port 4002
│   ├── routes/          # Port 4003
│   ├── booking/         # Port 4004
│   ├── reservation/     # Port 4005 (Redis-based)
│   └── payment/         # Port 4006 (Production Ready - Phase 1 & 2)
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

## Tech Stack

- **Framework**: NestJS 11.x
- **Database**: Microsoft SQL Server
- **ORM**: TypeORM
- **Cache**: Redis (Reservation Service)
- **Authentication**: JWT (Passport)
- **API Docs**: Swagger/OpenAPI
- **Microservices**: TCP-based communication

## Features

- **Domestic Flights Only**: Hệ thống chỉ hỗ trợ bay nội địa Việt Nam
  - 20 sân bay nội địa Việt Nam (HAN, SGN, DAD, CXR, PQC, HUI, VCA, HPH, VDO, THD, VII, DIN, VCL, UIH, TBB, PXU, BMV, DLI, CAH, VKG)
  - Tất cả routes đều là domestic routes (is_domestic = true)
  - Không hỗ trợ bay quốc tế
- **Microservices Architecture**: Tách biệt Search, Services, Routes, Booking, Reservation, Payment, Email
- **Backend-managed State**: Reservation Service quản lý state trong Redis (Hybrid: Database + Redis)
- **Seat Selection**: Tích hợp tính năng chọn ghế ngồi vào reservation và booking flow
  - Seat map API để hiển thị ghế available
  - Seat hold/release khi tạo/cancel reservation
  - Seat assignment vào booking khi tạo booking từ reservation
  - Seat selection là optional - user có thể tạo reservation mà không chọn ghế
- **Payment Service**: Production Ready với Phase 1 & 2 improvements
  - Idempotency & Duplicate Prevention
  - Amount Validation & Concurrency Control
  - Payment Gateway Integration Structure
  - Webhook Handling & Payment Expiration
  - Payment Method Availability & Notifications
- **Email Service**: Gmail API integration với queue management
  - Gmail API với OAuth 2.0
  - Email queue với retry logic và rate limiting (100 emails/phút)
  - 5 email templates (OTP payment, OTP password reset, payment success/failed, booking confirmation)
  - Async processing và health check
- **UUID v7**: Tất cả IDs sử dụng UUID v7 (time-ordered)
- **JWT Authentication**: Tự động extract userId từ token tại Gateway
- **Passenger Creation**: Tự động tạo passenger khi booking (với reuse logic)
- **Transaction Safety**: Booking & Payment creation với transaction rollback
