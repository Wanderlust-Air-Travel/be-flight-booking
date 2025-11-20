# API E2E Tests

Test suite toàn diện cho tất cả các API endpoints của Flight Booking System.

## Cấu trúc

```
test/
├── api/                    # Test files cho từng API module
│   ├── auth.e2e-spec.ts   # Auth API tests
│   ├── search.e2e-spec.ts # Search API tests
│   ├── reservation.e2e-spec.ts # Reservation API tests
│   ├── booking.e2e-spec.ts # Booking API tests
│   ├── payment.e2e-spec.ts # Payment API tests
│   └── email.e2e-spec.ts  # Email API tests
├── helpers/
│   └── test-helpers.ts    # Helper functions cho testing
├── setup.ts               # Global test setup
└── jest-e2e.json          # Jest configuration cho e2e tests
```

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

## Test Coverage

### Auth API
- ✅ Register user (happy & unhappy cases)
- ✅ Login (happy & unhappy cases)
- ✅ Refresh token (happy & unhappy cases)
- ✅ Logout (happy & unhappy cases)
- ✅ Get current user (happy & unhappy cases)

### Search API
- ✅ Search flights one-way (happy & unhappy cases)
- ✅ Search flights round-trip (happy & unhappy cases)
- ✅ Get fare options (happy & unhappy cases)

### Reservation API
- ✅ Create reservation one-way (happy & unhappy cases)
- ✅ Create reservation round-trip (happy & unhappy cases)
- ✅ List reservations (happy & unhappy cases)
- ✅ Get reservation by ID (happy & unhappy cases)
- ✅ Get reservation by code (happy & unhappy cases)
- ✅ Cancel reservation (happy & unhappy cases)
- ✅ Extend reservation (happy & unhappy cases)

### Booking API
- ✅ Create booking from reservation (happy & unhappy cases)
- ✅ Get booking fare details (happy & unhappy cases)
- ✅ Get booking payment info (happy & unhappy cases)
- ✅ Update booking passengers (happy & unhappy cases)

### Payment API
- ✅ Process payment (happy & unhappy cases)
- ✅ Create payment (happy & unhappy cases)
- ✅ Get payment by ID (happy & unhappy cases)
- ✅ Get payments by booking (happy & unhappy cases)
- ✅ Update payment status (happy & unhappy cases)
- ✅ Handle webhook (happy & unhappy cases)
- ✅ Idempotency key handling

### Email API
- ✅ Send email with custom content (happy & unhappy cases)
- ✅ Send email with template (happy & unhappy cases)
- ✅ Get email status (happy & unhappy cases)
- ✅ Health check (happy case)

## Test Helpers

File `test/helpers/test-helpers.ts` cung cấp các helper functions:

- `registerTestUser()` - Đăng ký user mới
- `loginTestUser()` - Login và lấy token
- `createAndLoginUser()` - Tạo user và login
- `searchFlightsOneWay()` - Tìm chuyến bay một chiều
- `searchFlightsRoundTrip()` - Tìm chuyến bay khứ hồi
- `getFareOptions()` - Lấy fare options
- `createReservationOneWay()` - Tạo reservation một chiều
- `createReservationRoundTrip()` - Tạo reservation khứ hồi
- `createBookingFromReservation()` - Tạo booking từ reservation
- `processPayment()` - Xử lý payment

## Notes

- Tất cả tests sử dụng test data thực tế từ database đã được seed
- Tests tự động tạo và cleanup test data
- Mỗi test case độc lập, không phụ thuộc vào test khác
- Timeout mặc định: 60 giây cho mỗi test

