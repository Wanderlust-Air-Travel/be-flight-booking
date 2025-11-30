# Flight Booking Backend

Backend cho hệ thống đặt vé máy bay nội địa Việt Nam, sử dụng NestJS với Microservices Architecture.

## Yêu cầu

- **Node.js**: v18.x+ (nếu chạy local)
- **npm**: v9.x+ (nếu chạy local)
- **SQL Server**: 2019+ (Local hoặc Azure) - hoặc dùng Docker
- **Docker**: Để chạy toàn bộ hệ thống hoặc chỉ Redis
- **RabbitMQ**: Message broker cho async messaging (tự động setup trong Docker)
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
- Đợi SQL Server sẵn sàng (`docker/wait-for-sqlserver.ts`)
- Đợi RabbitMQ sẵn sàng (`docker/wait-for-rabbitmq.ts`)
- Tạo database và chạy TypeORM migrations (`docker/init-database.ts`)
- Verify database sẵn sàng (`docker/wait-for-database.ts`)
- Seed database với dữ liệu mẫu
- Khởi động tất cả services (với delay để đảm bảo database sẵn sàng)

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
├── api-gateway/         # REST API + WebSocket Gateway (port 3000)
│   └── modules/
│       └── realtime/    # WebSocket Gateway cho real-time updates
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

- **[API Documentation](./docs/api/)** - API endpoints và flow analysis (bao gồm WebSocket)
- **[Database Documentation](./docs/database/)** - Setup, SQL scripts, ERD
- **[Setup Guides](./docs/setup/)** - Redis, WSL, troubleshooting
- **[Design Documents](./docs/design/)** - Microservices design
- **[Real-time Implementation](./docs/REALTIME_IMPLEMENTATION.md)** - WebSocket implementation guide

**Swagger UI**: `http://localhost:3000/api-docs`

**WebSocket Endpoint**: `ws://localhost:3000/realtime` (Socket.IO namespace)

## Tech Stack

- **Framework**: NestJS 11.x
- **Database**: Microsoft SQL Server
- **ORM**: TypeORM
- **Cache**: Redis (Reservation Service, Idempotency, Booking State, WebSocket Pub/Sub)
- **Message Broker**: RabbitMQ (Async messaging, Event-driven communication)
- **Real-time Communication**: WebSocket (Socket.IO) với Redis Pub/Sub
- **Authentication**: JWT (Passport)
- **API Docs**: Swagger/OpenAPI
- **Microservices**: TCP-based communication (synchronous) + RabbitMQ (asynchronous)

## Features

- **Domestic Flights Only**: Hệ thống chỉ hỗ trợ bay nội địa Việt Nam
  - 20 sân bay nội địa Việt Nam (HAN, SGN, DAD, CXR, PQC, HUI, VCA, HPH, VDO, THD, VII, DIN, VCL, UIH, TBB, PXU, BMV, DLI, CAH, VKG)
  - Tất cả routes đều là domestic routes (is_domestic = true)
  - Không hỗ trợ bay quốc tế
- **Guest Booking Support**: Người dùng chưa đăng nhập có thể đặt chuyến bay
  - Optional authentication cho booking và reservation APIs
  - Contact information bắt buộc cho guest bookings
  - Passenger được tạo với `user_id = null` cho guest bookings
  - Booking được tạo với `user_id = null` cho guest bookings
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
  - 6 email templates (OTP payment, OTP password reset, payment success/failed, ticket confirmation)
  - Async processing và health check
  - Ticket confirmation email với chi tiết đầy đủ (seat, cabin class, flight details, check-in time)
- **RabbitMQ Integration**: Async messaging và event-driven architecture
  - Email notifications qua RabbitMQ queue (non-blocking)
  - Ticket creation sau payment qua RabbitMQ queue
  - Automatic reconnection và message persistence
  - Fallback to TCP nếu RabbitMQ không available
  - Management UI tại `http://localhost:15672` (admin/admin123)
- **Real-time WebSocket Communication**: Real-time updates cho critical business flows
  - **Seat Availability Updates**: Real-time seat status changes để tránh conflict khi nhiều user cùng chọn ghế
  - **Reservation Countdown Timer**: Server-synced countdown timer (business critical) - sync từ server mỗi giây
  - **Payment Status Updates**: Real-time payment confirmation (UX critical) - immediate feedback khi payment status thay đổi
  - WebSocket Gateway tại namespace `/realtime` với Socket.IO
  - Redis Pub/Sub để broadcast events across multiple API Gateway instances
  - Hỗ trợ cả authenticated users (JWT) và guest users (Session ID)
  - Architecture: Backend-managed state - BE quản lý state, FE chỉ hiển thị
- **UUID v7**: Tất cả IDs sử dụng UUID v7 (time-ordered)
- **JWT Authentication**: Optional authentication cho một số APIs, required cho các APIs khác
- **Passenger Creation**: Tự động tạo passenger khi booking (với reuse logic cho authenticated users)
- **Transaction Safety**: Booking & Payment creation với transaction rollback
