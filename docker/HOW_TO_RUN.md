# Hướng dẫn chạy Backend API

Hướng dẫn đơn giản cho Frontend developers.

## Yêu cầu

- Docker Desktop/Engine
- Git

## Chạy Backend

```bash
# Clone repository
git clone <repository-url>
cd be-flight-booking

# Chạy Backend (lần đầu mất 20-50 phút)
docker-compose -f docker-compose-full-services.yml up --build -d
```

Lệnh này tự động:
1. Đợi SQL Server sẵn sàng (`wait-for-sqlserver.ts`)
2. Tạo database và chạy migrations (`init-database.ts`)
3. Verify database sẵn sàng (`wait-for-database.ts`)
4. Seed data
5. Khởi động tất cả services (với delay để đảm bảo database sẵn sàng)

## Kiểm tra

- **Swagger UI**: http://localhost:3000/api-docs
- **Health Check**: http://localhost:3000/health
- **Containers**: `docker-compose -f docker-compose-full-services.yml ps` (tất cả phải "Up (healthy)")

## Lệnh thường dùng

```bash
# Xem logs
docker-compose -f docker-compose-full-services.yml logs -f backend

# Dừng (giữ data)
docker-compose -f docker-compose-full-services.yml down

# Dừng và xóa data (reset)
docker-compose -f docker-compose-full-services.yml down -v

# Restart
docker-compose -f docker-compose-full-services.yml restart backend

# Rebuild
docker-compose -f docker-compose-full-services.yml up --build -d
```

## Troubleshooting

**Port conflict:** Đổi port trong `docker-compose-full-services.yml`

**Backend không khởi động:**
```bash
docker-compose -f docker-compose-full-services.yml logs backend
docker-compose -f docker-compose-full-services.yml down -v && docker-compose -f docker-compose-full-services.yml up --build -d
```

**Không kết nối được API:**
```bash
docker-compose -f docker-compose-full-services.yml ps  # Kiểm tra containers
curl http://localhost:3000/health  # Test health check
```

## Database (nếu cần)

**Từ host (SSMS/DBeaver):**
- Server: `localhost,1434`
- Database: `flight_booking_db`
- User: `sa` | Password: `Passw0rd123!`

**Từ Docker network:**
- Server: `sqlserver:1433`
- Database: `flight_booking_db`
- User: `sa` | Password: `Passw0rd123!`

> **Lưu ý:** Port 1434 trên host để tránh conflict với SQL Server local

## Chạy chỉ SQL Server và Redis (cho dev local)

Nếu bạn chỉ cần database và cache, không cần backend:

```bash
docker-compose up -d
```

**Thông tin kết nối:**
- SQL Server: `localhost,1434` (User: `sa`, Password: `Passw0rd123!`)
- Redis: `localhost:6379`

## Checklist

- [ ] Docker đã cài và đang chạy
- [ ] Port 3000 chưa được dùng
- [ ] Đã đợi đủ thời gian (lần đầu 20-50 phút)
- [ ] Containers đang chạy: `docker-compose -f docker-compose-full-services.yml ps`
- [ ] Đã xem logs: `docker-compose -f docker-compose-full-services.yml logs backend`

## Tài liệu thêm

- [Docker README](./README.md)
- [MIGRATIONS.md](./MIGRATIONS.md)
- [README.md](../README.md)
