# Hướng dẫn chạy E2E Tests

## Prerequisites

Trước khi chạy tests, đảm bảo:

1. **Docker services đang chạy:**
   ```bash
   docker-compose -f docker-compose.yml up -d
   ```

2. **Kiểm tra các microservices đang chạy trong Docker:**
   ```bash
   docker ps
   ```
   Đảm bảo container `backend` đang chạy và expose các ports:
   - API Gateway (port 3000)
   - Search Microservice (port 4001)
   - Services Microservice (port 4002)
   - Routes Microservice (port 4003)
   - Booking Microservice (port 4004)
   - Reservation Microservice (port 4005)
   - Payment Microservice (port 4006) **Quan trọng cho Payment API tests**
   - Email Microservice (port 4007)

3. **Kiểm tra Payment microservice có thể kết nối được:**
   ```bash
   # Windows PowerShell
   Test-NetConnection -ComputerName localhost -Port 4006
   
   # Hoặc sử dụng telnet (nếu có)
   telnet localhost 4006
   ```

4. **Database đã được seed:**
   ```bash
   npm run seed:full
   ```

5. **File `.env` được cấu hình đúng:**
   Đảm bảo file `.env` có các biến sau (hoặc sử dụng `env.example`):
   ```env
   PAYMENT_MS_HOST=127.0.0.1
   PAYMENT_MS_PORT=4006
   SEARCH_MS_HOST=127.0.0.1
   SEARCH_MS_PORT=4001
   BOOKING_MS_HOST=127.0.0.1
   BOOKING_MS_PORT=4004
   RESERVATION_MS_HOST=127.0.0.1
   RESERVATION_MS_PORT=4005
   EMAIL_MS_HOST=127.0.0.1
   EMAIL_MS_PORT=4007
   ```
   
   **Lưu ý:** Khi chạy tests, API Gateway chạy trên localhost và kết nối đến microservices qua các ports đã được Docker expose. File `test/setup.ts` sẽ tự động set các giá trị mặc định nếu không có trong `.env`.

## Chạy Tests

### Chạy tất cả tests:
```bash
npm run test:e2e
```

### Chạy một test file cụ thể:
```bash
# Test Search API (bao gồm seat map với isSelectable mới)
npm run test:e2e -- search.e2e-spec.ts

# Test Booking State API
npm run test:e2e -- booking-state.e2e-spec.ts

# Test Reservation API
npm run test:e2e -- reservation.e2e-spec.ts

# Test Booking API
npm run test:e2e -- booking.e2e-spec.ts

# Test Auth API
npm run test:e2e -- auth.e2e-spec.ts
```

### Chạy test case cụ thể (theo pattern):
```bash
# Test seat map với isSelectable (NEW)
npm run test:e2e -- search.e2e-spec.ts -t "should return both economy and business seats"

# Test auto-fetch cabinType từ booking state (NEW)
npm run test:e2e -- search.e2e-spec.ts -t "auto-fetch cabinType"

# Test isSelectable logic (NEW)
npm run test:e2e -- search.e2e-spec.ts -t "isSelectable"

# Test reservation với seat selection (UPDATED)
npm run test:e2e -- reservation.e2e-spec.ts -t "seat"
```

### Chạy với coverage:
```bash
npm run test:e2e -- --coverage
```

### Chạy với watch mode:
```bash
npm run test:e2e -- --watch
```

### Chạy với verbose output (để debug):
```bash
npm run test:e2e -- --verbose
```

### Chạy test và chỉ hiển thị failed tests:
```bash
npm run test:e2e -- --silent
```

### Chạy một test case cụ thể (theo tên):
```bash
npm run test:e2e -- --testNamePattern="should register"
```

## Test Coverage

Test suite bao gồm:

- **Auth API**: Register, Login, Refresh, Logout, Get Current User
- **Search API**: Search flights (one-way & round-trip), Get fare options, **Get seat map (UPDATED với isSelectable)**
  - **NEW**: API trả về cả economy và business seats
  - **NEW**: Validate `isSelectable` field cho mỗi seat
  - **NEW**: Test auto-fetch `cabinType` từ booking state
- **Booking State API**: Save cabin selection, Save seat selection, Get booking state
- **Reservation API**: Create, Get, List, Cancel, Extend (UPDATED với seat selection validation)
  - **UPDATED**: Validate seat selection với `isSelectable` logic
- **Booking API**: Create from reservation, Get fare details, Get payment info, Update passengers (UPDATED với seat assignment)
- **Payment API**: Create, Process, Get, Update status, Webhook, Idempotency
- **Email API**: Send email, Get status, Health check

Tất cả đều có **happy cases** và **unhappy cases**.

## Thay đổi mới trong Tests (Seat Map API)

### Helper Functions mới:
- `validateSeatMapResponse()` - Validate cấu trúc response và `isSelectable` logic
- `findSelectableSeat()` - Tìm seat có `isSelectable = true` cho cabin type được request

### Test Cases mới:
1. **Test API trả về cả economy và business seats:**
   ```bash
   npm run test:e2e -- search.e2e-spec.ts -t "should return both economy and business seats"
   ```

2. **Test `isSelectable` logic:**
   - Economy seats có `isSelectable = true` khi request economy cabin
   - Business seats có `isSelectable = false` khi request economy cabin
   - Ngược lại cho business cabin

3. **Test auto-fetch `cabinType` từ booking state:**
   ```bash
   npm run test:e2e -- search.e2e-spec.ts -t "auto-fetch cabinType"
   ```

## Troubleshooting

### Lỗi: "Cannot connect to microservice" hoặc Payment API tests fail với 400/500
**Nguyên nhân:** Payment microservice không chạy hoặc không thể kết nối được.

**Giải pháp:**
1. Kiểm tra Docker container đang chạy:
   ```bash
   docker ps | grep backend
   ```

2. Kiểm tra logs của Payment microservice:
   ```bash
   docker logs backend | grep -i payment
   ```
   Tìm dòng: `Payment microservice is listening on 0.0.0.0:4006`

3. Kiểm tra port 4006 có được expose không:
   ```bash
   # Windows PowerShell
   Test-NetConnection -ComputerName localhost -Port 4006
   ```
   Nếu không kết nối được, kiểm tra `docker-compose-full-services.yml` có dòng:
   ```yaml
   ports:
     - "4006:4006"  # Payment MS
   ```

4. Restart Docker container nếu cần:
   ```bash
   docker-compose -f docker-compose-full-services.yml restart backend
   ```

5. Kiểm tra environment variables trong Docker:
   ```bash
   docker exec backend env | grep PAYMENT_MS
   ```
   Phải có: `PAYMENT_MS_HOST=0.0.0.0` và `PAYMENT_MS_PORT=4006`

### Lỗi: "Database connection failed"
- Đảm bảo SQL Server đang chạy trong Docker
- Kiểm tra database credentials trong `.env` file
- Kiểm tra port mapping: `1434:1433` (host:container)

### Lỗi: "No flights found"
- Chạy seed script: `npm run seed:full`
- Kiểm tra database có dữ liệu flights:
  ```bash
  docker exec -it sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Passw0rd123!" -d flight_booking_db -Q "SELECT COUNT(*) FROM Flights"
  ```

### Lỗi: Tests timeout
- Tăng timeout trong `test/setup.ts` nếu cần
- Kiểm tra network latency giữa API Gateway và microservices

