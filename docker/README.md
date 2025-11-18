# Docker Setup Guide

Hướng dẫn chạy toàn bộ hệ thống Flight Booking Backend bằng Docker.

> **Hướng dẫn chi tiết từng bước:** [HOW_TO_RUN.md](./HOW_TO_RUN.md)

## Yêu cầu

- Docker Desktop (Windows/Mac) hoặc Docker Engine (Linux)
- Docker Compose v2.0+

## Cách sử dụng

### 0. Chỉ chạy Redis (nếu chỉ cần Redis)

Nếu bạn chỉ cần chạy Redis để test local:

```bash
docker-compose -f docker-compose.redis.yml up -d
```

Hoặc dừng:
```bash
docker-compose -f docker-compose.redis.yml down
```

### 1. Chạy toàn bộ hệ thống (lần đầu)

```bash
docker-compose up --build
```

Lệnh này sẽ:
- Build Docker image cho backend
- Khởi động SQL Server
- Khởi động Redis
- Tự động tạo database và user
- **Chạy TypeORM migrations** (tạo tables, indexes, triggers)
- Seed database với dữ liệu mẫu
- Khởi động tất cả services (API Gateway + 5 microservices)

**Xem chi tiết về migrations:** [MIGRATIONS.md](./MIGRATIONS.md)

**Lưu ý:** Lần đầu chạy có thể mất 5-10 phút để:
- Download images
- Build backend
- Seed database (có thể mất 15-45 phút tùy máy)

### 2. Chạy ở chế độ background

```bash
docker-compose up -d --build
```

### 3. Xem logs

```bash
# Xem logs của tất cả services
docker-compose logs -f

# Xem logs của một service cụ thể
docker-compose logs -f backend
docker-compose logs -f sqlserver
docker-compose logs -f redis
```

### 4. Dừng hệ thống

```bash
docker-compose down
```

### 5. Dừng và xóa dữ liệu (reset hoàn toàn)

```bash
docker-compose down -v
```

**Cảnh báo:** Lệnh này sẽ xóa tất cả dữ liệu trong database và Redis!

### 6. Chỉ chạy lại backend (không rebuild)

```bash
docker-compose restart backend
```

### 7. Rebuild và chạy lại

```bash
docker-compose up --build -d
```

## Kiểm tra hệ thống

Sau khi các services đã khởi động, kiểm tra:

1. **API Gateway**: http://localhost:3000
2. **Swagger UI**: http://localhost:3000/api-docs
3. **SQL Server**: `localhost:1433`
4. **Redis**: `localhost:6379`

### Test API

```bash
# Test Search API
curl "http://localhost:3000/search/flights?origin=HAN&destination=SGN&departDate=2025-11-18&tripType=one_way&adults=1&minors=0"

# Test Health Check
curl http://localhost:3000/health
```

## Cấu trúc Services

- **API Gateway**: Port 3000
- **Search Microservice**: Port 4001
- **Services Microservice**: Port 4002
- **Routes Microservice**: Port 4003
- **Booking Microservice**: Port 4004
- **Reservation Microservice**: Port 4005

## Database Credentials

- **Server**: `sqlserver` (trong Docker network) hoặc `localhost` (từ host)
- **Port**: `1433`
- **Database**: `flight_booking_db`
- **User**: `maxnoah`
- **Password**: `Passw0rd123!`
- **SA Password**: `Passw0rd123!`

## Redis Credentials

- **Host**: `redis` (trong Docker network) hoặc `localhost` (từ host)
- **Port**: `6379`
- **Password**: (không có)

## Troubleshooting

### Backend không kết nối được SQL Server

Kiểm tra SQL Server đã sẵn sàng:
```bash
docker-compose logs sqlserver
```

Đợi thông báo "SQL Server is ready" trước khi backend khởi động.

### Migrations không chạy hoặc bị lỗi

Xem chi tiết: [MIGRATIONS.md](./MIGRATIONS.md)

**Chạy migrations thủ công:**
```bash
docker-compose exec backend npm run migration:run
```

**Xem trạng thái migrations:**
```bash
docker-compose exec backend npm run migration:show
```

### Seed database bị lỗi

Seed có thể bị lỗi nếu database đã có dữ liệu. Điều này không ảnh hưởng đến việc chạy services. Để seed lại:

```bash
docker-compose exec backend npm run seed-db
```

### Services không khởi động

Kiểm tra logs:
```bash
docker-compose logs backend
```

Đảm bảo tất cả microservices đã khởi động trước API Gateway.

### Port đã được sử dụng

Nếu port đã được sử dụng, sửa trong `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # Thay đổi port host
```

### Reset hoàn toàn

Nếu gặp vấn đề, reset toàn bộ:
```bash
docker-compose down -v
docker-compose up --build
```

## Environment Variables

Tất cả environment variables được cấu hình trong `docker-compose.yml`. Để thay đổi, sửa file này và rebuild:

```bash
docker-compose up --build -d
```

## Development Mode

Để phát triển, bạn có thể:
1. Chỉ chạy SQL Server và Redis bằng Docker
2. Chạy backend services trên máy local

```bash
# Chỉ chạy SQL Server và Redis
docker-compose up -d sqlserver redis

# Chạy backend trên máy local
npm install
npm run start:dev  # Terminal 1
npm run start:search:dev  # Terminal 2
# ... các services khác
```

## Production

Để deploy production, cần:
1. Thay đổi passwords trong `docker-compose.yml`
2. Sử dụng secrets management
3. Cấu hình SSL/TLS
4. Setup backup cho database
5. Cấu hình monitoring và logging

