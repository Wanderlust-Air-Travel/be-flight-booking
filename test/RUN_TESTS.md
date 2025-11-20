# Hướng dẫn chạy E2E Tests

## Prerequisites

Trước khi chạy tests, đảm bảo:

1. **Docker services đang chạy:**
   ```bash
   docker-compose -f docker-compose-full-services.yml up -d
   ```

2. **Database đã được seed:**
   ```bash
   npm run seed:full
   ```

3. **Tất cả microservices đang chạy:**
   - API Gateway (port 3000)
   - Search Microservice (port 4001)
   - Services Microservice (port 4002)
   - Routes Microservice (port 4003)
   - Booking Microservice (port 4004)
   - Reservation Microservice (port 4005)
   - Payment Microservice (port 4006)
   - Email Microservice (port 4007)

## Chạy Tests

### Chạy tất cả tests:
```bash
npm run test:e2e
```

### Chạy một test file cụ thể:
```bash
npm run test:e2e -- auth.e2e-spec.ts
```

### Chạy với coverage:
```bash
npm run test:e2e -- --coverage
```

### Chạy với watch mode:
```bash
npm run test:e2e -- --watch
```

### Chạy một test case cụ thể:
```bash
npm run test:e2e -- --testNamePattern="should register"
```

## Test Coverage

Test suite bao gồm:

- ✅ **Auth API**: Register, Login, Refresh, Logout, Get Current User
- ✅ **Search API**: Search flights (one-way & round-trip), Get fare options
- ✅ **Reservation API**: Create, Get, List, Cancel, Extend
- ✅ **Booking API**: Create from reservation, Get fare details, Get payment info, Update passengers
- ✅ **Payment API**: Create, Process, Get, Update status, Webhook, Idempotency
- ✅ **Email API**: Send email, Get status, Health check

Tất cả đều có **happy cases** và **unhappy cases**.

## Troubleshooting

### Lỗi: "Cannot connect to microservice"
- Đảm bảo tất cả microservices đang chạy
- Kiểm tra ports trong `.env` file

### Lỗi: "Database connection failed"
- Đảm bảo SQL Server đang chạy
- Kiểm tra database credentials trong `.env`

### Lỗi: "No flights found"
- Chạy seed script: `npm run seed:full`
- Kiểm tra database có dữ liệu flights

