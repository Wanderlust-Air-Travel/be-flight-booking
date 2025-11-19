# Docker Setup Guide

Hướng dẫn chạy toàn bộ hệ thống Flight Booking Backend bằng Docker.

> **Hướng dẫn chi tiết từng bước:** [HOW_TO_RUN.md](./HOW_TO_RUN.md)

## Yêu cầu

- Docker Desktop (Windows/Mac) hoặc Docker Engine (Linux)
- Docker Compose v2.0+

## Chạy hệ thống

### Chỉ chạy SQL Server và Redis (cho dev local)

Nếu bạn chỉ cần database và cache, không cần backend:

```bash
docker-compose up -d
```

**Thông tin kết nối:**
- SQL Server: `localhost,1434` (User: `sa`, Password: `Passw0rd123!`)
- Redis: `localhost:6379`

### Chạy toàn bộ hệ thống (lần đầu)

```bash
docker-compose -f docker-compose-full-services.yml up --build
```

Lệnh này sẽ tự động:
- Build backend image
- Khởi động SQL Server và Redis
- Tạo database và chạy migrations (qua script TypeScript `docker/init-database.ts`)
- Seed database
- Khởi động tất cả services

**Lưu ý:** Lần đầu có thể mất 20-50 phút (download images, build, seed).

### Chạy ở background

```bash
docker-compose -f docker-compose-full-services.yml up --build -d
```

### Xem logs

```bash
docker-compose -f docker-compose-full-services.yml logs -f backend
```

### Dừng hệ thống

```bash
docker-compose -f docker-compose-full-services.yml down        # Giữ data
docker-compose -f docker-compose-full-services.yml down -v     # Xóa tất cả data
```

## Kiểm tra

- **API Gateway**: http://localhost:3000
- **Swagger UI**: http://localhost:3000/api-docs
- **SQL Server**: `localhost:1434` (từ host) hoặc `sqlserver:1433` (từ Docker network)

## Database Credentials

**Từ host (SSMS, DBeaver):**
- Server: `localhost,1434` (port 1434, không phải 1433)
- User: `sa`
- Password: `Passw0rd123!`
- Database: `flight_booking_db`

**Từ trong Docker network (backend):**
- Server: `sqlserver:1433`
- User: `sa`
- Password: `Passw0rd123!`
- Database: `flight_booking_db`

**Lưu ý:** Port 1434 trên host để tránh conflict với SQL Server local (nếu có).

**Kết nối bằng SSMS:** Xem [SSMS_CONNECT_DOCKER.md](../docs/setup/SSMS_CONNECT_DOCKER.md)

## Services

- API Gateway: Port 3000
- Search MS: Port 4001
- Services MS: Port 4002
- Routes MS: Port 4003
- Booking MS: Port 4004
- Reservation MS: Port 4005
- Payment MS: Port 4006

## Troubleshooting

### Port conflict

Nếu có SQL Server local trên port 1433, Docker dùng port 1434. Đổi port trong `docker-compose.yml` hoặc `docker-compose-full-services.yml` nếu cần.

### Backend không kết nối được SQL Server

```bash
docker-compose -f docker-compose-full-services.yml logs sqlserver
# Đợi "SQL Server is ready"
```

### Migrations không chạy

```bash
docker-compose -f docker-compose-full-services.yml exec backend npm run migration:run
```

Xem chi tiết: [MIGRATIONS.md](./MIGRATIONS.md)

### Reset hoàn toàn

```bash
docker-compose -f docker-compose-full-services.yml down -v
docker-compose -f docker-compose-full-services.yml up --build
```

## Development Mode

Chỉ chạy SQL Server và Redis bằng Docker, backend chạy local:

```bash
docker-compose up -d sqlserver redis  # Dùng docker-compose.yml (chỉ DB + Redis)
npm run start:dev
```
