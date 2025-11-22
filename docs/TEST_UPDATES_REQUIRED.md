# Cập Nhật Tests Sau Khi Thêm Improvements

**Ngày tạo:** 2025-11-25  
**Mục đích:** Hướng dẫn cập nhật các test files để phù hợp với các thay đổi mới

---

## 📋 TỔNG QUAN

Sau khi implement các improvements, **TẤT CẢ** test files cần được cập nhật để:

1. ✅ Sử dụng URL prefix `/api/v1/` (API versioning)
2. ✅ Verify error response format mới
3. ✅ Verify request ID headers
4. ✅ Test các features mới (health checks, rate limiting, etc.)

---

## 🔄 CÁC THAY ĐỔI CẦN THỰC HIỆN

### 1. ✅ Update URL Prefix: `/api/v1/`

**Trước:**
```typescript
.post('/auth/register')
.get('/bookings/:id')
.post('/reservations')
```

**Sau:**
```typescript
.post('/api/v1/auth/register')
.get('/api/v1/bookings/:id')
.post('/api/v1/reservations')
```

**Files cần update:**
- ✅ `test/helpers/test-helpers.ts` - **ĐÃ UPDATE**
- ⚠️ `test/api/auth.e2e-spec.ts` - **CẦN UPDATE**
- ⚠️ `test/api/booking.e2e-spec.ts` - **CẦN UPDATE**
- ⚠️ `test/api/reservation.e2e-spec.ts` - **CẦN UPDATE**
- ⚠️ `test/api/payment.e2e-spec.ts` - **CẦN UPDATE**
- ⚠️ `test/api/search.e2e-spec.ts` - **CẦN UPDATE**
- ⚠️ `test/api/email.e2e-spec.ts` - **CẦN UPDATE**
- ✅ `test/api/health.e2e-spec.ts` - **ĐÃ UPDATE**
- ✅ `test/api/improvements.e2e-spec.ts` - **ĐÃ UPDATE**

---

### 2. ✅ Update Error Response Verification

**Trước:**
```typescript
expect(response.body).toHaveProperty('statusCode', 400);
expect(response.body.message).toBeDefined();
```

**Sau:**
```typescript
import { verifyErrorResponseFormat } from '../helpers/test-helpers';

verifyErrorResponseFormat(response, 400);
// Hoặc verify manually:
expect(response.body).toHaveProperty('statusCode', 400);
expect(response.body).toHaveProperty('timestamp');
expect(response.body).toHaveProperty('path');
expect(response.body).toHaveProperty('method');
expect(response.body).toHaveProperty('requestId');
expect(response.body).toHaveProperty('message');
expect(response.headers['x-request-id']).toBe(response.body.requestId);
```

---

### 3. ✅ Verify Request ID Headers

**Thêm vào mỗi test:**
```typescript
import { verifyRequestIdHeaders } from '../helpers/test-helpers';

// Trong test
const response = await request(app.getHttpServer())
  .get('/api/v1/health/liveness')
  .expect(200);

verifyRequestIdHeaders(response);
```

---

### 4. ✅ Update Test Setup

**Trước:**
```typescript
beforeAll(async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ ... }));
  await app.init();
});
```

**Sau:**
```typescript
beforeAll(async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();
  
  // Note: Global pipes, filters, interceptors are already set up in AppModule
  // But if you need to override, you can still do it here
  app.useGlobalPipes(new ValidationPipe({ ... }));
  
  await app.init();
});
```

**Lưu ý:** Với các improvements mới, `AppModule` đã có global interceptors và filters. Test setup có thể đơn giản hơn.

---

## 📝 VÍ DỤ CẬP NHẬT

### Ví dụ 1: Auth Test

**Trước:**
```typescript
it('should fail with invalid email (unhappy case)', async () => {
  const response = await request(app.getHttpServer())
    .post('/auth/register')
    .send({
      email: 'invalid-email',
      password: 'TestPassword123!',
    })
    .expect(400);

  expect(response.body).toHaveProperty('statusCode', 400);
  expect(response.body.message).toBeDefined();
});
```

**Sau:**
```typescript
import { verifyErrorResponseFormat, verifyRequestIdHeaders } from '../helpers/test-helpers';

it('should fail with invalid email (unhappy case)', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({
      email: 'invalid-email',
      password: 'TestPassword123!',
    })
    .expect(400);

  // Verify error response format
  verifyErrorResponseFormat(response, 400);
  
  // Verify request ID headers
  verifyRequestIdHeaders(response);
});
```

---

### Ví dụ 2: Success Response với Request ID

**Trước:**
```typescript
it('should register a new user successfully (happy case)', async () => {
  const response = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ ... })
    .expect(201);

  expect(response.body).toHaveProperty('user');
  expect(response.body).toHaveProperty('access_token');
});
```

**Sau:**
```typescript
it('should register a new user successfully (happy case)', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({ ... })
    .expect(201);

  expect(response.body).toHaveProperty('user');
  expect(response.body).toHaveProperty('access_token');
  
  // Verify request ID headers (should be present in all responses)
  verifyRequestIdHeaders(response);
});
```

---

## 🔍 TEST FILES MỚI ĐÃ TẠO

### 1. `test/api/health.e2e-spec.ts`
- ✅ Test health check endpoints
- ✅ Verify request ID headers
- ✅ Test database, redis, memory health

### 2. `test/api/improvements.e2e-spec.ts`
- ✅ Test request ID tracking
- ✅ Test error response format
- ✅ Test API versioning
- ✅ Test rate limiting
- ✅ Test CORS headers

---

## 🛠️ HELPER FUNCTIONS MỚI

### `verifyErrorResponseFormat(response, expectedStatusCode)`
Verify error response có đầy đủ các fields:
- `statusCode`
- `timestamp`
- `path`
- `method`
- `requestId`
- `message`

### `verifyRequestIdHeaders(response)`
Verify response có request ID headers:
- `X-Request-Id`
- `X-Correlation-Id`

---

## 📋 CHECKLIST UPDATE

### Files cần update URLs:

- [ ] `test/api/auth.e2e-spec.ts`
  - [ ] `/auth/register` → `/api/v1/auth/register`
  - [ ] `/auth/login` → `/api/v1/auth/login`
  - [ ] `/auth/refresh` → `/api/v1/auth/refresh`
  - [ ] `/auth/logout` → `/api/v1/auth/logout`
  - [ ] `/auth/me` → `/api/v1/auth/me`

- [ ] `test/api/booking.e2e-spec.ts`
  - [ ] `/bookings` → `/api/v1/bookings`
  - [ ] `/bookings/:id/fare-details` → `/api/v1/bookings/:id/fare-details`
  - [ ] `/bookings/:id/payment-info` → `/api/v1/bookings/:id/payment-info`
  - [ ] `/bookings/:id/passengers` → `/api/v1/bookings/:id/passengers`

- [ ] `test/api/reservation.e2e-spec.ts`
  - [ ] `/reservations` → `/api/v1/reservations`
  - [ ] `/reservations/:id` → `/api/v1/reservations/:id`
  - [ ] `/reservations/code/:code` → `/api/v1/reservations/code/:code`
  - [ ] `/reservations/:id/cancel` → `/api/v1/reservations/:id/cancel`
  - [ ] `/reservations/:id/extend` → `/api/v1/reservations/:id/extend`

- [ ] `test/api/payment.e2e-spec.ts`
  - [ ] `/payments/bookings/:id` → `/api/v1/payments/bookings/:id`
  - [ ] `/payments/bookings/:id/process` → `/api/v1/payments/bookings/:id/process`

- [ ] `test/api/search.e2e-spec.ts`
  - [ ] `/search/flights` → `/api/v1/search/flights`
  - [ ] `/search/fare-options` → `/api/v1/search/fare-options`
  - [ ] `/search/seats` → `/api/v1/search/seats`

- [ ] `test/api/email.e2e-spec.ts`
  - [ ] `/emails` → `/api/v1/emails`
  - [ ] `/emails/:id/status` → `/api/v1/emails/:id/status`

### Files đã update:
- ✅ `test/helpers/test-helpers.ts` - **ĐÃ UPDATE TẤT CẢ URLs**
- ✅ `test/api/health.e2e-spec.ts` - **ĐÃ TẠO MỚI**
- ✅ `test/api/improvements.e2e-spec.ts` - **ĐÃ TẠO MỚI**

---

## 🚀 CÁCH UPDATE NHANH

### Option 1: Find & Replace (Recommended)

1. **Mở file test cần update**
2. **Find & Replace:**
   - Find: `'/auth/` → Replace: `'/api/v1/auth/`
   - Find: `'/bookings/` → Replace: `'/api/v1/bookings/`
   - Find: `'/reservations` → Replace: `'/api/v1/reservations`
   - Find: `'/payments/` → Replace: `'/api/v1/payments/`
   - Find: `'/search/` → Replace: `'/api/v1/search/`
   - Find: `'/emails/` → Replace: `'/api/v1/emails/`

3. **Thêm import helper functions:**
```typescript
import { 
  verifyErrorResponseFormat, 
  verifyRequestIdHeaders 
} from '../helpers/test-helpers';
```

4. **Update error assertions:**
```typescript
// Thay vì:
expect(response.body).toHaveProperty('statusCode', 400);

// Dùng:
verifyErrorResponseFormat(response, 400);
```

---

## ⚠️ LƯU Ý QUAN TRỌNG

### 1. Health Check Endpoints
Health check endpoints **KHÔNG** có version prefix:
- ✅ `/health` (không phải `/api/v1/health`)
- ✅ `/health/readiness`
- ✅ `/health/liveness`

**Lý do:** Health checks thường được gọi bởi orchestration tools (Kubernetes, Docker) và không cần versioning.

### 2. Error Response Format
Tất cả error responses giờ có format:
```json
{
  "statusCode": 400,
  "timestamp": "2025-11-25T00:00:00.000Z",
  "path": "/api/v1/auth/register",
  "method": "POST",
  "requestId": "uuid-v7-here",
  "message": "Validation failed"
}
```

### 3. Request ID Headers
Tất cả responses (success và error) đều có:
- `X-Request-Id` header
- `X-Correlation-Id` header

---

## 🧪 CHẠY TESTS

### Chạy tất cả tests:
```bash
npm run test:e2e
```

### Chạy test file cụ thể:
```bash
npm run test:e2e -- health.e2e-spec.ts
npm run test:e2e -- improvements.e2e-spec.ts
npm run test:e2e -- auth.e2e-spec.ts
```

### Chạy với coverage:
```bash
npm run test:e2e -- --coverage
```

---

## 📊 TEST COVERAGE MỚI

### Tests mới đã thêm:

1. **Health Checks:**
   - ✅ Full health check
   - ✅ Readiness probe
   - ✅ Liveness probe
   - ✅ Database health
   - ✅ Redis health

2. **Request ID Tracking:**
   - ✅ Auto-generate request ID
   - ✅ Use custom request ID from client
   - ✅ Request ID in all responses

3. **Error Response Format:**
   - ✅ 400 errors
   - ✅ 401 errors
   - ✅ 404 errors
   - ✅ Consistent format

4. **API Versioning:**
   - ✅ `/api/v1/` prefix
   - ✅ Default version

5. **Rate Limiting:**
   - ✅ Rate limit headers
   - ✅ 429 response when exceeded

---

## 🔧 TROUBLESHOOTING

### Test fails với 404:
- **Nguyên nhân:** URL thiếu `/api/v1/` prefix
- **Giải pháp:** Update URL trong test

### Test fails với error format không đúng:
- **Nguyên nhân:** Error response format đã thay đổi
- **Giải pháp:** Sử dụng `verifyErrorResponseFormat()` helper

### Request ID không có trong response:
- **Nguyên nhân:** Interceptor chưa được setup trong test
- **Giải pháp:** Đảm bảo `AppModule` được import đúng

---

## 📝 KẾT LUẬN

**Đã hoàn thành:**
- ✅ Tạo test files mới cho health checks và improvements
- ✅ Update test-helpers.ts với `/api/v1/` prefix
- ✅ Thêm helper functions để verify error format và request ID

**Cần làm:**
- ⚠️ Update tất cả test files còn lại với `/api/v1/` prefix
- ⚠️ Thêm verification cho request ID headers trong các tests
- ⚠️ Update error assertions để sử dụng helper functions

**Priority:**
1. **HIGH:** Update URLs trong tất cả test files
2. **MEDIUM:** Thêm request ID verification
3. **LOW:** Refactor error assertions để dùng helper functions

---

## 📚 REFERENCES

- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Jest Documentation](https://jestjs.io/docs/getting-started)

