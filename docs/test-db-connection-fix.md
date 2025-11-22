# Fix Lỗi Database Connection khi chạy E2E Tests

## Lỗi: "Login failed for user 'sa'"

### Nguyên nhân
1. SQL Server chưa chạy hoặc container chưa start
2. Password trong `.env` không khớp với password trong `docker-compose-full-services.yml`
3. Port không đúng

### Cách Fix

#### Bước 1: Kiểm tra SQL Server container đang chạy

```bash
docker ps | grep sqlserver
```

Nếu không thấy container, start lại:

```bash
docker-compose -f docker-compose-full-services.yml up -d sqlserver
```

Chờ container healthy (30-60 giây):

```bash
docker ps | grep sqlserver
# Phải thấy STATUS: healthy
```

#### Bước 2: Kiểm tra file `.env`

Tạo hoặc cập nhật file `.env` trong project root với nội dung:

```env
# Database - PHẢI KHỚP VỚI docker-compose-full-services.yml
DB_HOST=localhost
DB_PORT=1434          # Port host (mapped từ 1433)
DB_USER=sa
DB_PASS=Passw0rd123!  # Password từ docker-compose
DB_NAME=flight_booking_db
DB_ENCRYPT=false
DB_TRUST_CERT=true
```

**Quan trọng**: Password phải là `Passw0rd123!` (giống trong docker-compose)

#### Bước 3: Test kết nối database

```bash
npm run test:db
```

Hoặc:

```bash
node tools/test-db-connection.js
```

Nếu connection thành công, bạn sẽ thấy:
```
✅ Connection successful!
```

#### Bước 4: Chạy lại E2E test

```bash
npm run test:e2e -- auth.e2e-spec.ts
```

### Kiểm tra nhanh bằng Docker

Nếu muốn test trực tiếp trong container:

```bash
# Test connection từ trong container
docker exec -it sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost \
  -U sa \
  -P "Passw0rd123!" \
  -C \
  -Q "SELECT @@VERSION AS Version, DB_NAME() AS CurrentDatabase"
```

### Checklist

- [ ] SQL Server container đang chạy và healthy
- [ ] File `.env` tồn tại trong project root
- [ ] `DB_HOST=localhost`
- [ ] `DB_PORT=1434` (port host, không phải 1433)
- [ ] `DB_USER=sa`
- [ ] `DB_PASS=Passw0rd123!` (có dấu chấm than)
- [ ] `DB_NAME=flight_booking_db`
- [ ] `DB_ENCRYPT=false`
- [ ] `DB_TRUST_CERT=true`
- [ ] Test connection thành công (`npm run test:db`)

### Troubleshooting

#### Nếu vẫn lỗi "Login failed":

1. **Reset SQL Server password trong container:**
   ```bash
   docker exec -it sqlserver /opt/mssql-tools18/bin/sqlcmd \
     -S localhost \
     -U sa \
     -P "Passw0rd123!" \
     -C \
     -Q "ALTER LOGIN sa WITH PASSWORD='Passw0rd123!'"
   ```

2. **Khởi động lại container:**
   ```bash
   docker-compose -f docker-compose-full-services.yml restart sqlserver
   ```

3. **Kiểm tra logs:**
   ```bash
   docker logs sqlserver
   ```

#### Nếu lỗi "Connection refused":

1. Kiểm tra port mapping:
   ```bash
   docker port sqlserver
   # Phải thấy: 1433/tcp -> 0.0.0.0:1434
   ```

2. Test kết nối từ host:
   ```bash
   telnet localhost 1434
   ```

