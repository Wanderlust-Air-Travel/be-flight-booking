# Email Service - OTP Testing Guide

**Ngày tạo:** 2025-11-25  
**Mục đích:** Hướng dẫn test Email service và OTP functionality

---

## 📋 TỔNG QUAN

Email service hỗ trợ gửi OTP thông qua **template-based emails**. Có 2 loại OTP templates:

1. **`otp_payment`** - OTP cho thanh toán
2. **`otp_password_reset`** - OTP cho đặt lại mật khẩu

---

## 🔍 KIỂM TRA EMAIL SERVICE CÓ HOẠT ĐỘNG KHÔNG

### 1. Health Check

**Endpoint:** `GET /api/v1/emails/health`

**Request:**
```bash
curl -X GET http://localhost:3000/api/v1/emails/health
```

**Response:**
```json
{
  "status": "ok",
  "gmailReady": true,
  "queueStats": {
    "total": 10,
    "queued": 2,
    "sending": 1,
    "sent": 6,
    "failed": 1,
    "rateLimitRemaining": 95
  }
}
```

**Kiểm tra:**
- ✅ `status: "ok"` - Service đang hoạt động
- ✅ `gmailReady: true` - Gmail API đã sẵn sàng
- ✅ `queueStats` - Thống kê queue

---

### 2. Test Gửi OTP

**Endpoint:** `POST /api/v1/emails/send`

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

#### A. Gửi OTP Payment

**Request:**
```json
{
  "to": "user@example.com",
  "template": "otp_payment",
  "templateData": {
    "otp": "123456",
    "expiresIn": "15 minutes"
  }
}
```

**Response:**
```json
{
  "emailId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "to": "user@example.com",
  "status": "queued",
  "createdAt": "2025-11-25T00:00:00.000Z"
}
```

#### B. Gửi OTP Password Reset

**Request:**
```json
{
  "to": "user@example.com",
  "template": "otp_password_reset",
  "templateData": {
    "otp": "789012",
    "expiresIn": "10 minutes"
  }
}
```

---

## 🧪 CHẠY TESTS

### Chạy Email Tests

```bash
# Chạy tất cả email tests
npm run test:e2e -- email.e2e-spec.ts

# Chạy test OTP cụ thể
npm run test:e2e -- email.e2e-spec.ts -t "OTP"
```

### Test Cases Mới Đã Thêm

1. ✅ **`should send OTP payment email successfully`**
   - Test gửi OTP payment với template `otp_payment`
   - Verify response có `emailId`, `status: 'queued'`

2. ✅ **`should send OTP password reset email successfully`**
   - Test gửi OTP password reset với template `otp_password_reset`
   - Verify response có `emailId`, `status: 'queued'`

3. ✅ **`should fail with OTP template but missing templateData`**
   - Test validation khi thiếu `templateData`
   - Expect 400 error

4. ✅ **`should send OTP with custom expiration time`**
   - Test gửi OTP với thời gian hết hạn tùy chỉnh
   - Verify email được queue thành công

---

## 🔧 TROUBLESHOOTING

### Email Service Không Hoạt Động

#### 1. Kiểm tra Email Microservice có chạy không

```bash
# Kiểm tra trong docker-compose
docker ps | grep email

# Hoặc check logs
docker logs <email-service-container>
```

#### 2. Kiểm tra Gmail API Configuration

**Environment Variables cần có:**
```env
GMAIL_CLIENT_ID=your-client-id
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REFRESH_TOKEN=your-refresh-token
GMAIL_USER=your-email@gmail.com
```

**Kiểm tra trong code:**
- File: `src/microservices/email/services/email-queue.service.ts`
- Method: `isGmailReady()` - Should return `true`

#### 3. Kiểm tra Email Queue

**Check queue stats:**
```bash
curl http://localhost:3000/api/v1/emails/health
```

**Nếu `gmailReady: false`:**
- Gmail API chưa được config đúng
- Refresh token đã hết hạn
- Client credentials không đúng

#### 4. Kiểm tra Email Status

**Endpoint:** `GET /api/v1/emails/:emailId/status`

**Request:**
```bash
curl -X GET \
  http://localhost:3000/api/v1/emails/{emailId}/status \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "emailId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "to": "user@example.com",
  "status": "sent", // hoặc "queued", "sending", "failed"
  "createdAt": "2025-11-25T00:00:00.000Z",
  "sentAt": "2025-11-25T00:00:05.000Z"
}
```

**Status values:**
- `queued` - Email đang trong queue
- `sending` - Đang gửi
- `sent` - Đã gửi thành công
- `failed` - Gửi thất bại

---

## 📝 CÁCH SỬ DỤNG OTP TRONG CODE

### 1. Gửi OTP Payment

```typescript
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { EMAIL_MS } from 'src/microservices/email/email.messages';

// Generate OTP
const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

// Send OTP email
const emailResult = await firstValueFrom(
  this.emailClient.send(EMAIL_MS.PATTERN.SEND_EMAIL, {
    to: user.email,
    template: 'otp_payment',
    templateData: {
      otp: otpCode,
      expiresIn: '15 minutes',
    },
  }),
);

// Store OTP in Redis/Database for verification
await this.redisService.set(`otp:payment:${userId}`, otpCode, 900); // 15 minutes
```

### 2. Gửi OTP Password Reset

```typescript
const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

const emailResult = await firstValueFrom(
  this.emailClient.send(EMAIL_MS.PATTERN.SEND_EMAIL, {
    to: user.email,
    template: 'otp_password_reset',
    templateData: {
      otp: otpCode,
      expiresIn: '10 minutes',
    },
  }),
);

// Store OTP for verification
await this.redisService.set(`otp:password-reset:${user.email}`, otpCode, 600); // 10 minutes
```

---

## 🎯 TEST SCENARIOS

### Scenario 1: Gửi OTP Payment Thành Công

```bash
# 1. Login để lấy access token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'

# 2. Gửi OTP
curl -X POST http://localhost:3000/api/v1/emails/send \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "user@example.com",
    "template": "otp_payment",
    "templateData": {
      "otp": "123456",
      "expiresIn": "15 minutes"
    }
  }'

# 3. Check email status
curl -X GET http://localhost:3000/api/v1/emails/{emailId}/status \
  -H "Authorization: Bearer <access_token>"
```

### Scenario 2: Kiểm Tra Email Service Health

```bash
# Health check (không cần auth)
curl -X GET http://localhost:3000/api/v1/emails/health

# Expected: gmailReady should be true
```

---

## ⚠️ LƯU Ý QUAN TRỌNG

### 1. Email Service là Async

- Email được **queue** và gửi **asynchronously**
- Response trả về ngay với `status: 'queued'`
- Cần check status sau để biết email đã được gửi chưa

### 2. Rate Limiting

- Gmail API có rate limit
- Check `rateLimitRemaining` trong health check
- Nếu `rateLimitRemaining` thấp, cần đợi

### 3. OTP Storage

- **KHÔNG** lưu OTP trong email response
- OTP chỉ được gửi qua email
- Cần lưu OTP trong Redis/Database để verify

### 4. Template Data

- Template `otp_payment` và `otp_password_reset` cần:
  - `otp` (required) - Mã OTP
  - `expiresIn` (optional) - Thời gian hết hạn (default: "15 minutes")

---

## 📊 MONITORING

### Check Queue Stats

```bash
curl http://localhost:3000/api/v1/emails/health
```

**Monitor:**
- `queueStats.queued` - Số email đang chờ
- `queueStats.sending` - Số email đang gửi
- `queueStats.failed` - Số email thất bại
- `rateLimitRemaining` - Số email còn lại trong rate limit

### Check Failed Emails

Nếu `queueStats.failed > 0`:
1. Check logs của Email microservice
2. Verify Gmail API credentials
3. Check network connectivity

---

## 🔗 RELATED FILES

- **Email Controller:** `src/api-gateway/modules/email/email.controller.ts`
- **Email Service:** `src/microservices/email/email.service.ts`
- **Email Template Service:** `src/microservices/email/services/email-template.service.ts`
- **Email Queue Service:** `src/microservices/email/services/email-queue.service.ts`
- **Test File:** `test/api/email.e2e-spec.ts`
- **Email Templates Enum:** `src/shared/constants/enums/email.enum.ts`

---

## ✅ CHECKLIST

- [ ] Email microservice đang chạy
- [ ] Gmail API credentials đã được config
- [ ] Health check trả về `gmailReady: true`
- [ ] Test gửi OTP thành công
- [ ] Email được queue và gửi thành công
- [ ] Test cases pass

---

## 🚀 NEXT STEPS

1. **Verify Email Service:**
   ```bash
   npm run test:e2e -- email.e2e-spec.ts
   ```

2. **Check Health:**
   ```bash
   curl http://localhost:3000/api/v1/emails/health
   ```

3. **Test OTP:**
   - Gửi OTP payment
   - Gửi OTP password reset
   - Verify email được gửi thành công

---

## 📚 REFERENCES

- [Email Service Documentation](./IMPLEMENTATION_SUMMARY.md)
- [Test Updates](./TEST_UPDATES_COMPLETED.md)
- [Gmail API Documentation](https://developers.google.com/gmail/api)

