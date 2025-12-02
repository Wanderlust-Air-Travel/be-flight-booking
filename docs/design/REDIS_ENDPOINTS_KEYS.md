# Redis Endpoints & Keys Documentation

Tài liệu này liệt kê toàn bộ các endpoint sử dụng Redis và key patterns của chúng để phân biệt và quản lý.

---

## Tổng quan

- **Key Prefix:** `flight-booking:` (config trong `redis.config.ts`)
- **Redis Config:** `be-flight-booking/src/shared/config/redis.config.ts`
- **TTL Defaults:**
  - Reservation: 15 phút (900s)
  - Booking State: 30 phút (1800s)
  - Idempotency: 2 giờ (7200s)
  - OTP Payment: 15 phút (900s)
  - OTP Password Reset: 10 phút (600s)
  - OTP Cancellation: 15 phút (900s)

---

## 1. Booking State Endpoints

### 1.1. `POST /api/v1/booking-state/cabin`

**Mục đích:** Lưu cabin selection vào Redis

**Redis Key Pattern:**
- **Authenticated User:** `flight-booking:booking:state:{userId}:{flightInstanceId}`
- **Guest User:** `flight-booking:booking:state:guest:{sessionId}:{flightInstanceId}`

**Key Format:**
- Authenticated: `booking:state:{userId}:{flightInstanceId}`
- Guest: `booking:state:guest:{sessionId}:{flightInstanceId}`

**TTL:** 30 phút (1800s)

**Vị trí code:**
- **Controller:** `be-flight-booking/src/api-gateway/modules/booking-state/booking-state.controller.ts:50`
- **Service:** `be-flight-booking/src/shared/services/booking-state.service.ts:90-163`
- **Repository:** `be-flight-booking/src/shared/repositories/booking-state.repository.ts:48-67` (save method)
- **Key Generation:** `be-flight-booking/src/shared/repositories/booking-state.repository.ts:33-38`

**Redis Operations:**
- `SET` - Lưu booking state với TTL

---

### 1.2. `POST /api/v1/booking-state/seat`

**Mục đích:** Lưu seat selection vào Redis

**Redis Key Pattern:** Giống như cabin endpoint

**TTL:** 30 phút (1800s)

**Vị trí code:**
- **Controller:** `be-flight-booking/src/api-gateway/modules/booking-state/booking-state.controller.ts:114`
- **Service:** `be-flight-booking/src/shared/services/booking-state.service.ts:90-163`
- **Repository:** `be-flight-booking/src/shared/repositories/booking-state.repository.ts:48-67` (save method)

**Redis Operations:**
- `SET` - Lưu booking state với TTL

---

### 1.3. `GET /api/v1/booking-state`

**Mục đích:** Lấy tất cả booking states của user/guest

**Redis Key Pattern:**
- **Authenticated:** `flight-booking:booking:state:{userId}:*`
- **Guest:** `flight-booking:booking:state:guest:{sessionId}:*`

**Vị trí code:**
- **Controller:** `be-flight-booking/src/api-gateway/modules/booking-state/booking-state.controller.ts:373`
- **Repository:** `be-flight-booking/src/shared/repositories/booking-state.repository.ts:177-214` (findAllByIdentifier method)

**Redis Operations:**
- `KEYS` - Tìm tất cả keys matching pattern
- `GET` - Lấy từng booking state

---

### 1.4. `GET /api/v1/booking-state/:flightInstanceId`

**Mục đích:** Lấy booking state cho một flight instance cụ thể

**Redis Key Pattern:**
- **Authenticated:** `flight-booking:booking:state:{userId}:{flightInstanceId}`
- **Guest:** `flight-booking:booking:state:guest:{sessionId}:{flightInstanceId}`

**Vị trí code:**
- **Controller:** `be-flight-booking/src/api-gateway/modules/booking-state/booking-state.controller.ts:412`
- **Repository:** `be-flight-booking/src/shared/repositories/booking-state.repository.ts:76-87` (findOne method)

**Redis Operations:**
- `GET` - Lấy booking state

---

### 1.5. `DELETE /api/v1/booking-state/:flightInstanceId`

**Mục đích:** Xóa booking state cho một flight instance

**Redis Key Pattern:** Giống như GET endpoint

**Vị trí code:**
- **Controller:** `be-flight-booking/src/api-gateway/modules/booking-state/booking-state.controller.ts:456`
- **Repository:** `be-flight-booking/src/shared/repositories/booking-state.repository.ts:96-109` (delete method)

**Redis Operations:**
- `DEL` - Xóa booking state

---

## 2. Reservation Endpoints

### 2.1. `POST /api/v1/reservations`

**Mục đích:** Tạo reservation và lưu vào Redis

**Redis Keys:**
1. `flight-booking:reservation:{reservationId}` - Reservation data
2. `flight-booking:reservation:code:{reservationCode}` - Map code → reservationId

**Key Format:**
- Reservation: `reservation:{reservationId}`
- Code mapping: `reservation:code:{reservationCode}`

**TTL:** 15 phút (900s)

**Vị trí code:**
- **Controller:** `be-flight-booking/src/api-gateway/modules/reservation/reservation.controller.ts:29`
- **Service:** `be-flight-booking/src/microservices/reservation/reservation.service.ts:151-364` (createReservation method)
- **Key Generation:** `be-flight-booking/src/microservices/reservation/reservation.service.ts:52-61`

**Redis Operations:**
- `SET` - Lưu reservation data với TTL
- `SET` - Lưu code mapping với TTL
- `DEL` - Xóa booking state sau khi tạo reservation thành công

---

### 2.2. `GET /api/v1/reservations/:id`

**Mục đích:** Lấy reservation từ Redis (fallback to DB)

**Redis Keys:**
- `flight-booking:reservation:{reservationId}` - Get reservation data

**Vị trí code:**
- **Controller:** `be-flight-booking/src/api-gateway/modules/reservation/reservation.controller.ts:170`
- **Service:** `be-flight-booking/src/microservices/reservation/reservation.service.ts:370-465` (getReservation method)

**Redis Operations:**
- `GET` - Lấy reservation data
- `TTL` - Lấy remaining TTL
- `DEL` - Xóa nếu expired

---

### 2.3. `GET /api/v1/reservations/code/:code`

**Mục đích:** Lấy reservation bằng code (6 ký tự)

**Redis Keys:**
1. `flight-booking:reservation:code:{code}` - Get reservationId từ code
2. `flight-booking:reservation:{reservationId}` - Get reservation data

**Vị trí code:**
- **Controller:** `be-flight-booking/src/api-gateway/modules/reservation/reservation.controller.ts:224`
- **Service:** `be-flight-booking/src/microservices/reservation/reservation.service.ts:370-465` (getReservation method)

**Redis Operations:**
- `GET` - Lấy reservationId từ code
- `GET` - Lấy reservation data từ reservationId

---

### 2.4. `POST /api/v1/reservations/:id/cancel`

**Mục đích:** Hủy reservation và xóa khỏi Redis

**Redis Keys:**
- `flight-booking:reservation:{reservationId}` - Delete reservation
- `flight-booking:reservation:code:{code}` - Delete code mapping

**Vị trí code:**
- **Controller:** `be-flight-booking/src/api-gateway/modules/reservation/reservation.controller.ts:286`
- **Service:** `be-flight-booking/src/microservices/reservation/reservation.service.ts:500-550` (cancelReservation method)

**Redis Operations:**
- `DEL` - Xóa reservation data
- `DEL` - Xóa code mapping

---

### 2.5. `POST /api/v1/reservations/:id/extend`

**Mục đích:** Gia hạn reservation TTL trong Redis

**Redis Keys:**
- `flight-booking:reservation:{reservationId}` - Update với TTL mới

**Vị trí code:**
- **Controller:** `be-flight-booking/src/api-gateway/modules/reservation/reservation.controller.ts:404`
- **Service:** `be-flight-booking/src/microservices/reservation/reservation.service.ts:552-600` (extendReservation method)

**Redis Operations:**
- `GET` - Lấy reservation data
- `SET` - Update với TTL mới

---

## 3. Payment Idempotency

### 3.1. `POST /api/v1/payments/bookings/:bookingId/process`

**Mục đích:** Process payment với idempotency check

**Redis Key Pattern:** `flight-booking:idempotency:{idempotencyKey}`

**Key Format:** `idempotency:{idempotencyKey}`

**TTL:** 2 giờ (7200s)

**Vị trí code:**
- **Controller:** `be-flight-booking/src/api-gateway/modules/payment/payment.controller.ts:182` (processPayment)
- **Service:** `be-flight-booking/src/microservices/payment/payment.service.ts:195-454` (processPayment method)
- **Validation:** `be-flight-booking/src/microservices/payment/services/payment-validation.service.ts:163-250` (checkIdempotency method)
- **Cache:** `be-flight-booking/src/microservices/payment/services/payment-validation.service.ts:255-303` (cachePaymentResponse, cachePaymentResponseDto)

**Redis Operations:**
- `GET` - Check idempotency key (Redis first)
- `SET` - Cache payment response sau khi tạo thành công

**Lưu ý:**
- Hybrid approach: Redis (fast) → DB (fallback/guarantee)
- Normalize UUIDs to lowercase để tránh case sensitivity issues

---

## 4. OTP Storage Endpoints

### 4.1. `POST /api/v1/auth/otp/payment/send`

**Mục đích:** Gửi OTP cho payment verification

**Redis Key Pattern:** `flight-booking:otp:payment:{userId}`

**Key Format:** `otp:payment:{userId}`

**TTL:** 15 phút (900s)

**Vị trí code:**
- **Controller:** `be-flight-booking/src/api-gateway/modules/auth/auth.controller.ts:102`
- **Service:** `be-flight-booking/src/shared/services/otp-storage.service.ts:35-48` (storePaymentOtp method)

**Redis Operations:**
- `SET` - Lưu OTP với TTL

---

### 4.2. `POST /api/v1/auth/otp/payment/verify`

**Mục đích:** Verify OTP cho payment

**Redis Key Pattern:** `flight-booking:otp:payment:{userId}`

**Vị trí code:**
- **Controller:** `be-flight-booking/src/api-gateway/modules/auth/auth.controller.ts:130`
- **Service:** `be-flight-booking/src/shared/services/otp-storage.service.ts:56-80` (verifyPaymentOtp method)

**Redis Operations:**
- `GET` - Lấy OTP để verify
- `DEL` - Xóa OTP sau khi verify thành công (one-time use)

---

### 4.3. `POST /api/v1/auth/otp/password-reset/send`

**Mục đích:** Gửi OTP cho password reset

**Redis Key Pattern:** `flight-booking:otp:password-reset:{email}`

**Key Format:** `otp:password-reset:{email}`

**TTL:** 10 phút (600s)

**Vị trí code:**
- **Controller:** `be-flight-booking/src/api-gateway/modules/auth/auth.controller.ts:158`
- **Service:** `be-flight-booking/src/shared/services/otp-storage.service.ts:89-102` (storePasswordResetOtp method)

**Redis Operations:**
- `SET` - Lưu OTP với TTL

---

### 4.4. `POST /api/v1/auth/otp/password-reset/verify`

**Mục đích:** Verify OTP cho password reset

**Redis Key Pattern:** `flight-booking:otp:password-reset:{email}`

**Vị trí code:**
- **Controller:** `be-flight-booking/src/api-gateway/modules/auth/auth.controller.ts:186`
- **Service:** `be-flight-booking/src/shared/services/otp-storage.service.ts:110-134` (verifyPasswordResetOtp method)

**Redis Operations:**
- `GET` - Lấy OTP để verify
- `DEL` - Xóa OTP sau khi verify thành công (one-time use)

---

### 4.5. `POST /api/v1/auth/otp/cancellation/send`

**Mục đích:** Gửi OTP cho booking cancellation

**Redis Key Pattern:** `flight-booking:otp:cancellation:{userId}:{bookingId}`

**Key Format:** `otp:cancellation:{userId}:{bookingId}`

**TTL:** 15 phút (900s)

**Vị trí code:**
- **Controller:** `be-flight-booking/src/api-gateway/modules/auth/auth.controller.ts:217`
- **Service:** `be-flight-booking/src/shared/services/otp-storage.service.ts:144-158` (storeCancellationOtp method)

**Redis Operations:**
- `SET` - Lưu OTP với TTL

---

### 4.6. `POST /api/v1/auth/otp/cancellation/verify`

**Mục đích:** Verify OTP cho booking cancellation

**Redis Keys:**
1. `flight-booking:otp:cancellation:{userId}:{bookingId}` - Verify và delete
2. `flight-booking:otp:cancellation:verified:{userId}:{bookingId}` - Store verification token

**Key Format:**
- OTP: `otp:cancellation:{userId}:{bookingId}`
- Verification token: `otp:cancellation:verified:{userId}:{bookingId}`

**TTL:** 10 phút (600s) cho verification token

**Vị trí code:**
- **Controller:** `be-flight-booking/src/api-gateway/modules/auth/auth.controller.ts:248`
- **Service:** `be-flight-booking/src/shared/services/otp-storage.service.ts:167-196` (verifyCancellationOtp method)

**Redis Operations:**
- `GET` - Lấy OTP để verify
- `DEL` - Xóa OTP sau khi verify thành công
- `SET` - Lưu verification token (valid 10 phút)

---

### 4.7. `PATCH /api/v1/bookings/:id/cancel` (Sử dụng verification token)

**Mục đích:** Cancel booking sau khi verify OTP

**Redis Key Pattern:** `flight-booking:otp:cancellation:verified:{userId}:{bookingId}`

**Vị trí code:**
- **Controller:** `be-flight-booking/src/api-gateway/modules/booking/booking.controller.ts:444`
- **Service:** `be-flight-booking/src/shared/services/otp-storage.service.ts:204-213` (isCancellationOtpVerified method)
- **Cleanup:** `be-flight-booking/src/shared/services/otp-storage.service.ts:220-229` (deleteCancellationVerificationToken method)

**Redis Operations:**
- `GET` - Check verification token
- `DEL` - Xóa verification token sau khi cancel thành công

---

## 5. Real-time Services (Redis Pub/Sub)

### 5.1. Payment Status Service

**Mục đích:** Broadcast payment status changes qua WebSocket

**Redis Channels:**
1. `payment:status:booking:{bookingId}` - Booking-level channel
2. `payment:status:payment:{paymentId}` - Payment-level channel

**Channel Format:**
- Booking: `payment:status:booking:{bookingId}`
- Payment: `payment:status:payment:{paymentId}`

**TTL:** N/A (Pub/Sub channels không có TTL)

**Vị trí code:**
- **Service:** `be-flight-booking/src/api-gateway/modules/realtime/services/payment-status.service.ts`
- **Publish:** `payment-status.service.ts:107-130` (publishPaymentStatusChange method)
- **Channels:** `payment-status.service.ts:177-186`
- **Subscribe:** `payment-status.service.ts:62-83`
- **Unsubscribe:** `payment-status.service.ts:88-101`

**Redis Operations:**
- `PUBLISH` - Publish payment status change
- `SUBSCRIBE` - Subscribe to channel
- `UNSUBSCRIBE` - Unsubscribe from channel

**Lưu ý:**
- Sử dụng Redis Pub/Sub để broadcast real-time updates
- Payment Service gọi `publishPaymentStatusChange()` khi payment status thay đổi

---

### 5.2. Seat Availability Service

**Mục đích:** Broadcast seat availability changes qua WebSocket

**Redis Channel:** `seat:availability:{flightInstanceId}`

**Channel Format:** `seat:availability:{flightInstanceId}`

**TTL:** N/A (Pub/Sub channels không có TTL)

**Vị trí code:**
- **Service:** `be-flight-booking/src/api-gateway/modules/realtime/services/seat-availability.service.ts`
- **Publish:** `seat-availability.service.ts:103-115` (publishSeatChange method)
- **Channel:** `seat-availability.service.ts:152-154`
- **Subscribe:** `seat-availability.service.ts:61-73`
- **Unsubscribe:** `seat-availability.service.ts:78-94`

**Redis Operations:**
- `PUBLISH` - Publish seat availability change
- `SUBSCRIBE` - Subscribe to channel
- `UNSUBSCRIBE` - Unsubscribe from channel

**Lưu ý:**
- Sử dụng Redis Pub/Sub để broadcast real-time seat updates
- Được gọi khi seat được select/release

---

## Tổng hợp Redis Key Patterns

| **Key Pattern** | **TTL** | **Mục đích** | **File Location** |
|----------------|---------|-------------|-------------------|
| `flight-booking:booking:state:{userId}:{flightInstanceId}` | 30 phút | Booking state (authenticated) | `booking-state.repository.ts:33-38` |
| `flight-booking:booking:state:guest:{sessionId}:{flightInstanceId}` | 30 phút | Booking state (guest) | `booking-state.repository.ts:33-38` |
| `flight-booking:reservation:{reservationId}` | 15 phút | Reservation data | `reservation.service.ts:52-53` |
| `flight-booking:reservation:code:{code}` | 15 phút | Map code → reservationId | `reservation.service.ts:59-60` |
| `flight-booking:idempotency:{idempotencyKey}` | 2 giờ | Payment idempotency | `payment-validation.service.ts:48-50` |
| `flight-booking:otp:payment:{userId}` | 15 phút | Payment OTP | `otp-storage.service.ts:40` |
| `flight-booking:otp:password-reset:{email}` | 10 phút | Password reset OTP | `otp-storage.service.ts:94` |
| `flight-booking:otp:cancellation:{userId}:{bookingId}` | 15 phút | Cancellation OTP | `otp-storage.service.ts:150` |
| `flight-booking:otp:cancellation:verified:{userId}:{bookingId}` | 10 phút | Cancellation verification token | `otp-storage.service.ts:184` |
| `payment:status:booking:{bookingId}` | N/A (Pub/Sub) | Payment status channel | `payment-status.service.ts:177-179` |
| `payment:status:payment:{paymentId}` | N/A (Pub/Sub) | Payment status channel | `payment-status.service.ts:184-186` |
| `seat:availability:{flightInstanceId}` | N/A (Pub/Sub) | Seat availability channel | `seat-availability.service.ts:152-154` |

---

## Redis Operations Summary

### SET Operations
- Booking state (cabin, seat)
- Reservation data
- Reservation code mapping
- Payment idempotency cache
- OTP storage (payment, password-reset, cancellation)
- Cancellation verification token

### GET Operations
- Booking state retrieval
- Reservation retrieval (Hybrid: Redis first, DB fallback)
- Payment idempotency check
- OTP verification
- Cancellation verification token check

### DEL Operations
- Booking state cleanup (sau khi tạo reservation)
- Reservation cancellation
- OTP cleanup (sau khi verify)
- Cancellation verification token cleanup

### KEYS Operations
- Find all booking states for user/guest

### TTL Operations
- Get remaining TTL cho reservation
- Get remaining TTL cho booking state

### PUB/SUB Operations
- Payment status broadcasting
- Seat availability broadcasting

---

## Lưu ý quan trọng

1. **Key Prefix:** Tất cả keys có prefix `flight-booking:` (config trong `redis.config.ts:8`)
2. **TTL:** Được config trong `redis.config.ts:9-13`, có thể override bằng environment variables
3. **Guest vs Authenticated:** Booking state keys khác nhau cho guest (`guest:` prefix) và authenticated users
4. **Pub/Sub:** Payment status và seat availability dùng Redis Pub/Sub (không có TTL, channels tự động cleanup khi không có subscribers)
5. **Hybrid Approach:** Reservation và Payment idempotency sử dụng Redis first, DB fallback để đảm bảo reliability
6. **Case Sensitivity:** Payment idempotency keys normalize UUIDs to lowercase để tránh case sensitivity issues với SQL Server

---

## Redis CLI Commands để Debug

### Xem tất cả booking states
```bash
redis-cli KEYS "flight-booking:booking:state:*"
```

### Xem tất cả reservations
```bash
redis-cli KEYS "flight-booking:reservation:*"
```

### Xem tất cả OTPs
```bash
redis-cli KEYS "flight-booking:otp:*"
```

### Xem tất cả idempotency keys
```bash
redis-cli KEYS "flight-booking:idempotency:*"
```

### Xem TTL của một key
```bash
redis-cli TTL "flight-booking:reservation:{reservationId}"
```

### Xem value của một key
```bash
redis-cli GET "flight-booking:reservation:{reservationId}"
```

### Xóa một key
```bash
redis-cli DEL "flight-booking:reservation:{reservationId}"
```

### Monitor Redis commands (real-time)
```bash
redis-cli MONITOR
```

---

## Best Practices

1. **Always use key prefix:** Tất cả keys phải có prefix `flight-booking:` để tránh conflict
2. **Set appropriate TTL:** Mỗi key type có TTL phù hợp với business logic
3. **Handle Redis failures gracefully:** Fallback to DB khi Redis không available
4. **Normalize UUIDs:** Payment idempotency keys normalize UUIDs để tránh case sensitivity issues
5. **Cleanup after use:** Xóa keys sau khi không cần thiết (OTP sau verify, booking state sau reservation)
6. **Use Pub/Sub for real-time:** Payment status và seat availability dùng Pub/Sub thay vì polling

---

## Related Documentation

- `be-flight-booking/docs/setup/REDIS_SETUP.md` - Redis setup guide
- `be-flight-booking/docs/design/booking-state-architecture.md` - Booking state architecture
- `be-flight-booking/src/shared/config/redis.config.ts` - Redis configuration

