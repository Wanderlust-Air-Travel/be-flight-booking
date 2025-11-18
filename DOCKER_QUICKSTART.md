# Docker Quick Start Guide

Hướng dẫn nhanh để chạy toàn bộ hệ thống Flight Booking Backend bằng Docker.

## Bước 1: Clone repository

```bash
git clone <repository-url>
cd be-flight-booking
```

## Bước 2: Chạy Docker Compose

```bash
docker-compose up --build
```

## Bước 3: Đợi hệ thống khởi động

Lần đầu chạy sẽ mất khoảng:
- 2-3 phút: Download images và build backend
- 1-2 phút: SQL Server khởi động
- 1-2 phút: Tạo database và schema
- 15-45 phút: Seed database (tùy máy)

**Tổng cộng: ~20-50 phút lần đầu**

## Bước 4: Kiểm tra

Sau khi thấy log "API Gateway started", mở trình duyệt:

- **Swagger UI**: http://localhost:3000/api-docs
- **API Gateway**: http://localhost:3000

## Các lệnh hữu ích

```bash
# Xem logs
docker-compose logs -f

# Dừng hệ thống
docker-compose down

# Dừng và xóa dữ liệu (reset)
docker-compose down -v

# Chạy ở background
docker-compose up -d --build

# Restart một service
docker-compose restart backend
```

## Troubleshooting

### Port đã được sử dụng

Sửa ports trong `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # Thay đổi port
```

### Seed database bị lỗi

Không sao, services vẫn chạy được. Để seed lại:
```bash
docker-compose exec backend npm run seed-db
```

### Reset hoàn toàn

```bash
docker-compose down -v
docker-compose up --build
```

## Thông tin đăng nhập

- **Database User**: `maxnoah` / `12341234`
- **Database**: `flight_booking_db`
- **SA Password**: `YourStrong@Passw0rd`

## Xem thêm

Chi tiết đầy đủ: [docker/README.md](./docker/README.md)

