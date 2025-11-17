# Redis Setup Guide

## Tổng quan

Redis được sử dụng để quản lý **Reservation state** (giữ chỗ tạm thời) trong Booking Service. Đây là thiết kế chuẩn Microservice - backend quản lý state thay vì phụ thuộc frontend.

## Cài đặt Redis với Docker

### Bước 1: Chạy Redis Container

```bash
docker-compose up -d redis
```

Hoặc chạy trực tiếp:

```bash
docker run -d \
  --name flight-booking-redis \
  -p 6379:6379 \
  -v redis-data:/data \
  redis:7-alpine \
  redis-server --appendonly yes
```

### Bước 2: Kiểm tra Redis đang chạy

```bash
docker ps | grep redis
```

Hoặc test connection:

```bash
docker exec -it flight-booking-redis redis-cli ping
# Should return: PONG
```

### Bước 3: Cấu hình Environment Variables

Thêm vào file `.env`:

```env
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_KEY_PREFIX=flight-booking:
REDIS_RESERVATION_TTL=900  # 15 minutes (in seconds)
```

## Redis Keys Structure

```
flight-booking:reservation:{reservationId}     # Reservation data
flight-booking:reservation:code:{code}         # Map code -> reservationId
```

## Reservation TTL

- Default: 15 phút (900 seconds)
- Tự động expire sau TTL
- Có thể config qua `REDIS_RESERVATION_TTL`

## Dừng Redis

```bash
docker-compose down
# Hoặc
docker stop flight-booking-redis
```

## Xóa Redis Data

```bash
docker-compose down -v
# Hoặc
docker volume rm redis-data
```

## Troubleshooting

### Lỗi: "Redis connection failed"

1. Kiểm tra Redis đang chạy:
   ```bash
   docker ps | grep redis
   ```

2. Kiểm tra port 6379 không bị conflict:
   ```bash
   netstat -ano | findstr :6379
   ```

3. Kiểm tra environment variables trong `.env`

### Lỗi: "ECONNREFUSED"

- Redis chưa chạy hoặc sai host/port
- Kiểm tra `REDIS_HOST` và `REDIS_PORT` trong `.env`

## Redis CLI Commands (Testing)

```bash
# Connect to Redis
docker exec -it flight-booking-redis redis-cli

# List all keys
KEYS flight-booking:*

# Get reservation
GET flight-booking:reservation:{reservationId}

# Check TTL
TTL flight-booking:reservation:{reservationId}

# Delete key
DEL flight-booking:reservation:{reservationId}
```

