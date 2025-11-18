# Hướng dẫn chạy Full Services với Docker

Hướng dẫn chi tiết từng bước để chạy toàn bộ hệ thống Flight Booking Backend bằng Docker.

## 📋 Yêu cầu

Trước khi bắt đầu, đảm bảo bạn đã cài đặt:

- **Docker Desktop** (Windows/Mac) hoặc **Docker Engine** (Linux)
- **Docker Compose** v2.0+ (thường đi kèm với Docker Desktop)
- **Git** (để clone repository)

### Kiểm tra cài đặt

```bash
# Kiểm tra Docker
docker --version
# Output: Docker version 24.x.x hoặc cao hơn

# Kiểm tra Docker Compose
docker-compose --version
# Output: Docker Compose version v2.x.x hoặc cao hơn
```

## 🚀 Bước 1: Clone Repository

```bash
# Clone repository
git clone <repository-url>
cd be-flight-booking
```

## 🏗️ Bước 2: Chạy Full Services

### Cách 1: Chạy với build (Lần đầu hoặc sau khi thay đổi code)

```bash
docker-compose up --build
```

**Lệnh này sẽ:**
- ✅ Build Docker image cho backend
- ✅ Khởi động SQL Server container
- ✅ Khởi động Redis container
- ✅ Tự động tạo database và user
- ✅ Chạy TypeORM migrations (tạo tables, indexes, triggers)
- ✅ Seed database với dữ liệu mẫu
- ✅ Khởi động tất cả services:
  - API Gateway (port 3000)
  - Search Microservice (port 4001)
  - Services Microservice (port 4002)
  - Routes Microservice (port 4003)
  - Booking Microservice (port 4004)
  - Reservation Microservice (port 4005)

### Cách 2: Chạy ở chế độ background (detached mode)

```bash
docker-compose up --build -d
```

**Lợi ích:**
- Chạy ở background, không chiếm terminal
- Có thể đóng terminal mà services vẫn chạy

### Cách 3: Chạy không build (nếu đã build rồi)

```bash
docker-compose up
```

Hoặc ở background:
```bash
docker-compose up -d
```

## ⏱️ Thời gian chờ

**Lần đầu chạy:**
- ⏱️ 2-3 phút: Download images và build backend
- ⏱️ 1-2 phút: SQL Server khởi động
- ⏱️ 1-2 phút: Tạo database và chạy migrations
- ⏱️ 15-45 phút: Seed database (tùy máy)

**Tổng cộng: ~20-50 phút lần đầu**

**Các lần sau:**
- ⏱️ 1-2 phút: Khởi động containers
- ⏱️ 30 giây - 1 phút: Services sẵn sàng

## 📊 Bước 3: Kiểm tra Services

### 3.1. Kiểm tra containers đang chạy

```bash
docker-compose ps
```

**Kết quả mong đợi:**
```
NAME                       STATUS
flight-booking-backend     Up (healthy)
flight-booking-redis       Up (healthy)
flight-booking-sqlserver   Up (healthy)
```

### 3.2. Kiểm tra logs

```bash
# Xem logs của tất cả services
docker-compose logs -f

# Xem logs của một service cụ thể
docker-compose logs -f backend
docker-compose logs -f sqlserver
docker-compose logs -f redis
```

**Dấu hiệu thành công:**
- ✅ SQL Server: "SQL Server is ready"
- ✅ Backend: "Nest application successfully started"
- ✅ Migrations: "Executed X migration(s)"
- ✅ Seed: "Seed completed successfully"

### 3.3. Kiểm tra API

Mở trình duyệt và truy cập:

- **Swagger UI**: http://localhost:3000/api-docs
- **API Gateway**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

### 3.4. Test API bằng curl

```bash
# Test Search API
curl "http://localhost:3000/search/flights?origin=HAN&destination=SGN&departDate=2025-11-18&tripType=one_way&adults=1&minors=0"

# Test Health Check
curl http://localhost:3000/health
```

## 🛠️ Các lệnh hữu ích

### Dừng services

```bash
# Dừng nhưng giữ containers
docker-compose stop

# Dừng và xóa containers (giữ data)
docker-compose down
```

### Dừng và xóa tất cả (Reset hoàn toàn)

```bash
# ⚠️ CẢNH BÁO: Xóa tất cả dữ liệu!
docker-compose down -v
```

### Restart một service

```bash
# Restart backend
docker-compose restart backend

# Restart SQL Server
docker-compose restart sqlserver

# Restart Redis
docker-compose restart redis
```

### Rebuild và chạy lại

```bash
# Rebuild image và chạy lại
docker-compose up --build -d
```

### Xem logs real-time

```bash
# Tất cả services
docker-compose logs -f

# Một service cụ thể
docker-compose logs -f backend

# Chỉ 50 dòng cuối
docker-compose logs --tail 50 backend
```

### Vào trong container

```bash
# Vào container backend
docker-compose exec backend sh

# Vào container SQL Server
docker-compose exec sqlserver bash

# Vào container Redis
docker-compose exec redis sh
```

## 🔍 Kiểm tra chi tiết từng service

### 1. SQL Server

```bash
# Kiểm tra SQL Server đang chạy
docker-compose ps sqlserver

# Xem logs SQL Server
docker-compose logs sqlserver

# Test kết nối SQL Server
docker exec flight-booking-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Passw0rd123!" -C -Q "SELECT @@VERSION"
```

### 2. Redis

```bash
# Kiểm tra Redis đang chạy
docker-compose ps redis

# Test Redis connection
docker exec flight-booking-redis redis-cli ping
# Output: PONG
```

### 3. Backend Services

```bash
# Kiểm tra tất cả services
docker-compose ps backend

# Xem logs backend
docker-compose logs backend

# Test API Gateway
curl http://localhost:3000/health
```

## 📝 Thông tin đăng nhập

### Database

- **Server**: `sqlserver` (trong Docker) hoặc `localhost` (từ host)
- **Port**: `1433`
- **Database**: `flight_booking_db`
- **User**: `maxnoah`
- **Password**: `Passw0rd123!`
- **SA Password**: `Passw0rd123!`

### Redis

- **Host**: `redis` (trong Docker) hoặc `localhost` (từ host)
- **Port**: `6379`
- **Password**: (không có)

### API Endpoints

- **API Gateway**: http://localhost:3000
- **Swagger UI**: http://localhost:3000/api-docs
- **Search MS**: Port 4001 (TCP)
- **Services MS**: Port 4002 (TCP)
- **Routes MS**: Port 4003 (TCP)
- **Booking MS**: Port 4004 (TCP)
- **Reservation MS**: Port 4005 (TCP)

## 🐛 Troubleshooting

### Vấn đề 1: Port đã được sử dụng

**Lỗi:**
```
Error: bind: address already in use
```

**Giải pháp:**
1. Tìm process đang dùng port:
   ```bash
   # Windows
   netstat -ano | findstr :3000
   
   # Linux/Mac
   lsof -i :3000
   ```

2. Dừng process hoặc đổi port trong `docker-compose.yml`:
   ```yaml
   ports:
     - "3001:3000"  # Đổi port host
   ```

### Vấn đề 2: Backend không kết nối được SQL Server

**Lỗi:**
```
ConnectionError: Login failed for user 'maxnoah'
```

**Giải pháp:**
1. Kiểm tra SQL Server đã sẵn sàng:
   ```bash
   docker-compose logs sqlserver
   ```

2. Đợi SQL Server healthy:
   ```bash
   docker-compose ps sqlserver
   # Phải thấy: Up (healthy)
   ```

3. Kiểm tra user đã được tạo:
   ```bash
   docker exec flight-booking-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Passw0rd123!" -C -Q "SELECT name FROM sys.server_principals WHERE name = 'maxnoah'"
   ```

4. Nếu user chưa có, chạy lại init script:
   ```bash
   docker-compose exec backend node docker/init-database.js
   ```

### Vấn đề 3: Migrations không chạy

**Lỗi:**
```
Error running migrations
```

**Giải pháp:**
1. Chạy migrations thủ công:
   ```bash
   docker-compose exec backend npm run migration:run
   ```

2. Xem trạng thái migrations:
   ```bash
   docker-compose exec backend npm run migration:show
   ```

3. Xem chi tiết: [MIGRATIONS.md](./MIGRATIONS.md)

### Vấn đề 4: Seed database bị lỗi

**Lỗi:**
```
Seed failed
```

**Giải pháp:**
- Seed có thể bị lỗi nếu database đã có dữ liệu
- Điều này **không ảnh hưởng** đến việc chạy services
- Để seed lại:
  ```bash
  docker-compose exec backend npm run seed-db
  ```

### Vấn đề 5: Container không khởi động

**Lỗi:**
```
Container keeps restarting
```

**Giải pháp:**
1. Xem logs để tìm lỗi:
   ```bash
   docker-compose logs backend
   ```

2. Kiểm tra health status:
   ```bash
   docker-compose ps
   ```

3. Reset hoàn toàn:
   ```bash
   docker-compose down -v
   docker-compose up --build
   ```

### Vấn đề 6: Out of memory

**Lỗi:**
```
Container killed: out of memory
```

**Giải pháp:**
1. Tăng memory cho Docker:
   - Docker Desktop: Settings → Resources → Memory
   - Tối thiểu: 4GB, khuyến nghị: 8GB

2. Hoặc giảm số lượng services chạy cùng lúc

## 🔄 Workflow phát triển

### Development Mode

1. **Chỉ chạy SQL Server và Redis:**
   ```bash
   docker-compose up -d sqlserver redis
   ```

2. **Chạy backend trên máy local:**
   ```bash
   npm install
   npm run start:dev        # Terminal 1 - API Gateway
   npm run start:search:dev # Terminal 2 - Search MS
   # ... các services khác
   ```

### Production Mode

1. **Build image:**
   ```bash
   docker-compose build
   ```

2. **Chạy ở background:**
   ```bash
   docker-compose up -d
   ```

3. **Monitor logs:**
   ```bash
   docker-compose logs -f
   ```

## 📚 Tài liệu liên quan

- **[Docker README](./README.md)** - Hướng dẫn chi tiết về Docker setup
- **[MIGRATIONS.md](./MIGRATIONS.md)** - Hướng dẫn về TypeORM migrations
- **[DOCKER_QUICKSTART.md](../DOCKER_QUICKSTART.md)** - Hướng dẫn nhanh
- **[README.md](../README.md)** - Tài liệu tổng quan project

## ✅ Checklist

Trước khi báo lỗi, hãy kiểm tra:

- [ ] Docker và Docker Compose đã cài đặt
- [ ] Ports 3000, 4001-4005, 1433, 6379 chưa được sử dụng
- [ ] Đã chờ đủ thời gian cho services khởi động
- [ ] SQL Server đã healthy (kiểm tra bằng `docker-compose ps`)
- [ ] Đã xem logs để tìm lỗi cụ thể
- [ ] Đã thử reset: `docker-compose down -v && docker-compose up --build`

## 🎯 Quick Reference

```bash
# Chạy full services
docker-compose up --build -d

# Xem logs
docker-compose logs -f

# Dừng
docker-compose down

# Reset hoàn toàn
docker-compose down -v && docker-compose up --build

# Restart một service
docker-compose restart backend

# Vào container
docker-compose exec backend sh
```

---

**Chúc bạn thành công! 🚀**

