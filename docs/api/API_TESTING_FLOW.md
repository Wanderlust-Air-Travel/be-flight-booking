# API Testing Flow - Hướng dẫn Test API theo Flow

Tài liệu này hướng dẫn test API theo flow đầy đủ từ đầu đến cuối, bao gồm cả one-way, round-trip booking, và guest booking (không cần đăng nhập).

---

## Prerequisites
## Flow 1: One-Way Booking (Chuyến một chiều)

### Step 1: Register User (Optional - nếu chưa có account)

**Request:**
```http
POST {{base_url}}/auth/register
Content-Type: application/json

{
  "fullname": "Nguyen Van A",
  "email": "test@example.com",
  "password": "Password123!",
  "phone": "0901234567"
}
```

**Response:**
```json
{
  "userId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "email": "test@example.com",
  "fullname": "Nguyen Van A"
}
```

**Lưu ý:** Lưu `userId` vào Postman variable nếu cần.

---

### Step 2: Login

**Request:**
```http
POST {{base_url}}/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "Password123!"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71"
}
```

**Lưu ý:** 
- Lưu `access_token` vào Postman variable `access_token`
- Postman collection sẽ tự động set variable nếu có test script

---

### Step 3: Search Flights (One-Way)

**Request (One Way - Auto tripType):**
```http
GET {{base_url}}/search/flights?origin=HAN&destination=SGN&departDate={{departDate}}&adults=1&minors=0
```

**Request (One Way - Explicit tripType):**
```http
GET {{base_url}}/search/flights?origin=HAN&destination=SGN&departDate={{departDate}}&tripType=one_way&adults=1&minors=0
```

*Note: `tripType` là optional. Nếu không truyền, sẽ tự động set thành `one_way` khi không có `returnDate`.

**Response:**
```json
{
  "tripType": "one_way",
  "outbound": [
    {
      "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
      "flightNumber": "VN123",
      "departureAirport": "HAN",
      "arrivalAirport": "SGN",
      "departureDateTime": "2025-11-20T08:00:00",
      "arrivalDateTime": "2025-11-20T10:00:00",
      "availableSeats": 150,
      ...
    }
  ]
}
```

**Lưu ý:** 
- Lưu `flightInstanceId` từ response vào Postman variable `flightInstanceId`
- Chọn flight instance có `availableSeats > 0`

---

### Step 4: Get Fare Options

**Request:**
```http
GET {{base_url}}/search/fare-options?flightInstanceId={{flightInstanceId}}&cabinType=economy
```

**Response:**
```json
[
  {
    "fareClassCode": "YS",
    "name": "Economy Saver",
    "typeTicket": "Vé tiết kiệm",
    "price": 1577000,
    "availableSeats": 50,
    "desc": [
      { "text": "Hành lý xách tay 7kg", "status": true },
      { "text": "Hành lý ký gửi 20kg", "status": true },
      ...
    ]
  },
  {
    "fareClassCode": "YF",
    "name": "Economy Flex",
    "typeTicket": "Vé linh hoạt",
    "price": 3068000,
    "availableSeats": 30,
    ...
  }
]
```

**Lưu ý:** 
- Chọn một fare class (VD: `YS` - Economy Saver)
- Lưu `fareClassCode` nếu cần (thường dùng `YS`)

---

### Step 5: Create Reservation (One-Way)

**Request:**
```http
POST {{base_url}}/reservations
Authorization: Bearer {{access_token}}
Content-Type: application/json

{
  "segments": [
    {
      "flightInstanceId": "{{flightInstanceId}}",
      "fareClassCode": "YS",
      "segmentType": "outbound"
    }
  ],
  "numberOfPassengers": 1,
  "currencyCode": "VND"
}
```

**Response:**
```json
{
  "reservationId": "019a8f4a-bb0e-7402-a0c4-27647b89dc72",
  "reservationCode": "ABC123",
  "segments": [
    {
      "segmentId": "019a8f4a-bb0e-7402-a0c4-27647b89dc73",
      "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
      "fareClassCode": "YS",
      "segmentType": "outbound",
      "baseFare": 1577000,
      "taxAmount": 0,
      "feeAmount": 0
    }
  ],
  "numberOfPassengers": 1,
  "totalAmount": 1577000,
  "currencyCode": "VND",
  "status": "active",
  "expiresAt": "2025-11-20T10:15:00Z",
  "ttl": 900,
  "createdAt": "2025-11-20T10:00:00Z",
  "userId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71"
}
```

**Lưu ý:** 
- Postman collection sẽ tự động set `reservationId` và `reservationCode` vào variables
- Reservation expire sau 15 phút (900 seconds)
- Reservation được lưu trong cả Database và Redis (Hybrid Approach)

---

### Step 6: Create Booking from Reservation

**Request:**
```http
POST {{base_url}}/bookings?reservationId={{reservationId}}
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Request Body - Passengers có 2 cách:**

#### **Option 1: Sử dụng Passenger đã có trong database** (Tái sử dụng)

Nếu bạn đã từng đặt vé cho passenger này trước đó, bạn có thể dùng lại thông tin bằng cách chỉ cần gửi `passengerId`:

```json
{
  "passengers": [
    {
      "passengerId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",  // UUID v7 của passenger đã có
      "passengerType": "ADT"
    }
  ],
  "contactFullname": "Nguyen Van A",
  "contactEmail": "test@example.com",
  "contactPhone": "0901234567",
  "channel": "web"
}
```

**Khi nào dùng Option 1:**
- Bạn đã đặt vé cho passenger này trước đó
- Bạn có `passengerId` từ booking trước
- Muốn tái sử dụng thông tin đã lưu (tránh nhập lại)

#### **Option 2: Tạo Passenger mới** (Nhập thông tin mới)

Nếu đây là lần đầu đặt vé cho passenger này, bạn cần cung cấp đầy đủ thông tin:

```json
{
  "passengers": [
    {
      "passengerType": "ADT",              // Required: "ADT" (Adult), "CHD" (Child), "INF" (Infant)
      "fullname": "Nguyen Van A",          // Required: Tên đầy đủ
      "dob": "1990-01-15",                 // Required: Ngày sinh (YYYY-MM-DD)
      "gender": "Male",                    // Required: "Male" hoặc "Female"
      "documentNumber": "001234567890"     // Required: Số CMND/CCCD/Passport
    }
  ],
  "contactFullname": "Nguyen Van A",
  "contactEmail": "test@example.com",
  "contactPhone": "0901234567",
  "channel": "web"
}
```

**Khi nào dùng Option 2:**
- Đây là lần đầu đặt vé cho passenger này
- Bạn không có `passengerId`
- Cần nhập thông tin mới

**Lưu ý:**
- Backend sẽ tự động kiểm tra: Nếu passenger với cùng `documentNumber` đã tồn tại cho user → sẽ tái sử dụng passenger đã có (tránh duplicate)
- Passenger mới sẽ được link với user (từ JWT token) để có thể tái sử dụng sau này

**Response:**
```json
{
  "bookingId": "019a8f4a-bb0e-7402-a0c4-27647b89dc74",
  "pnrCode": "XYZ789",
  "totalAmount": 1577000,
  "currencyCode": "VND",
  "status": "pending"
}
```

**Lưu ý:** 
- Postman collection sẽ tự động set `bookingId` vào variable
- Reservation status được update thành `converted` trong Database
- Reservation được delete từ Redis

---

### Step 7: Get Booking Fare Details

**Request:**
```http
GET {{base_url}}/bookings/{{bookingId}}/fare-details
Authorization: Bearer {{access_token}}
```

**Response:**
```json
{
  "bookingId": "019a8f4a-bb0e-7402-a0c4-27647b89dc74",
  "pnrCode": "XYZ789",
  "fareClassName": "Economy Saver",
  "descriptions": [
    { "text": "Hành lý xách tay 7kg", "status": true },
    { "text": "Hành lý ký gửi 20kg", "status": true },
    ...
  ],
  "priceOneWay": 1577000,
  "totalPassengers": 1,
  "totalPrice": 1577000
}
```

---

### Step 8: Get Booking Payment Info

**Request:**
```http
GET {{base_url}}/bookings/{{bookingId}}/payment-info
Authorization: Bearer {{access_token}}
```

**Response:**
```json
{
  "bookingId": "019a8f4a-bb0e-7402-a0c4-27647b89dc74",
  "pnrCode": "XYZ789",
  "totalAmount": 1577000,
  "currencyCode": "VND",
  "contactFullname": "Nguyen Van A",
  "contactEmail": "test@example.com",
  "contactPhone": "0901234567",
  "status": "pending"
}
```

---

### Step 9: Process Payment

**Request:**
```http
POST {{base_url}}/payments/bookings/{{bookingId}}/process
Authorization: Bearer {{access_token}}
Content-Type: application/json

{
  "paymentMethodCode": "CREDIT_CARD",
  "transactionRef": "TXN123456789",
  "idempotencyKey": "idempotency-key-12345",
  "amount": 1577000
}
```

**Response:**
```json
{
  "paymentId": "019a8f4a-bb0e-7402-a0c4-27647b89dc75",
  "bookingId": "019a8f4a-bb0e-7402-a0c4-27647b89dc74",
  "pnrCode": "XYZ789",
  "amount": 1577000,
  "currencyCode": "VND",
  "paymentMethodCode": "CREDIT_CARD",
  "paymentMethodName": "Credit Card",
  "status": "success",
  "transactionRef": "TXN123456789",
  "createdAt": "2025-11-20T10:15:00Z",
  "paidAt": "2025-11-20T10:15:05Z",
  "expiresAt": "2025-11-20T10:30:00Z",
  "paymentUrl": "https://payment-gateway.com/pay/TXN123456789"
}
```

**Lưu ý:** 
- Postman collection sẽ tự động set `paymentId` vào variable
- Payment status = `success` và booking status tự động update thành `paid`
- `paidAt` được set khi payment thành công
- Response có thể chứa `paymentUrl` để redirect user đến payment gateway (trong production)
- Payment tự động expire sau 15 phút (`expiresAt` field)
- **Idempotency Key (Hybrid Approach)**:
  - `idempotencyKey` (optional): Client-generated unique key để prevent duplicate payments
  - **Flow**: System check Redis first (fast path, ~1ms) → Fallback to DB (guarantee path, ~20-50ms)
  - **Performance**: ~95% latency reduction khi dùng idempotency key (99% hit Redis cache)
  - **Safety**: Redis failures không block payment creation, always fallback to DB
  - **Recommendation**: Nên sử dụng idempotency key cho critical payments (generate UUID client-side)

---

### Step 10: Payment Gateway Webhook (Optional - Testing Webhook)

**Request (Simulate Webhook từ Payment Gateway):**
```http
POST {{base_url}}/payments/webhooks/mock
Content-Type: application/json
x-signature: test-signature

{
  "transactionId": "TXN123456789",
  "status": "success",
  "amount": 1577000,
  "currency": "VND",
  "message": "Payment processed successfully"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

**Lưu ý:**
- Endpoint này được gọi bởi payment gateway khi payment status thay đổi
- Trong production, webhook sẽ đến từ payment gateway thực tế (VNPay, MoMo, etc.)
- System verify webhook signature để đảm bảo request hợp lệ
- Payment status và booking status sẽ được update tự động
- Gateway name phải match: `vnpay`, `momo`, `stripe`, `mock` (for testing)

---

### Step 11: Verify Payment (Optional)

**Test Idempotency (Hybrid Approach):**
- Gửi lại request **Step 9** với **cùng idempotencyKey**
- **Expected**: System sẽ return existing payment (không tạo duplicate)
- **Flow**: Check Redis first → Hit cached payment → Return immediately (~1ms)
- **Verify**: Payment ID giống nhau, không có duplicate payment trong DB

**Request:**
```http
GET {{base_url}}/payments/{{paymentId}}
Authorization: Bearer {{access_token}}
```

Hoặc xem tất cả payments của booking:

```http
GET {{base_url}}/payments/bookings/{{bookingId}}
Authorization: Bearer {{access_token}}
```

---

### Step 12: Send Email (Optional - Testing Email Service)

**Test Email Service với Template:**

**Request:**
```http
POST {{base_url}}/emails/send
Authorization: Bearer {{access_token}}
Content-Type: application/json

{
  "to": "{{user_email}}",
  "template": "payment_success",
  "templateData": {
    "pnrCode": "{{pnrCode}}",
    "bookingId": "{{bookingId}}",
    "totalAmount": 1577000,
    "currency": "VND",
    "passengerName": "Nguyen Van A"
  }
}
```

**Response:**
```json
{
  "emailId": "019a8f4a-bb0e-7402-a0c4-27647b89dc80",
  "to": "user@example.com",
  "subject": "Xác nhận thanh toán thành công - Mã đặt chỗ: ABC123",
  "status": "queued",
  "queuedAt": "2025-11-20T10:20:00Z",
  "retryCount": 0
}
```

**Lưu ý:**
- Email được queue và xử lý bất đồng bộ
- Status: `queued` → `sending` → `sent` (hoặc `failed`)
- Rate limiting: 100 emails/phút
- Cần Email Microservice (port 4007) chạy
- Cần Gmail API credentials và token được cấu hình

---

### Step 13: Check Email Status (Optional)

**Request:**
```http
GET {{base_url}}/emails/{{emailId}}/status
Authorization: Bearer {{access_token}}
```

**Response:**
```json
{
  "emailId": "019a8f4a-bb0e-7402-a0c4-27647b89dc80",
  "to": "user@example.com",
  "subject": "Xác nhận thanh toán thành công - Mã đặt chỗ: ABC123",
  "status": "sent",
  "queuedAt": "2025-11-20T10:20:00Z",
  "sentAt": "2025-11-20T10:20:05Z",
  "retryCount": 0
}
```

---

### Step 14: Email Health Check (Optional)

**Request:**
```http
GET {{base_url}}/emails/health
```

**Response:**
```json
{
  "status": "ok",
  "gmailReady": true,
  "queueStats": {
    "total": 5,
    "queued": 1,
    "sending": 0,
    "sent": 4,
    "failed": 0,
    "rateLimitRemaining": 96
  }
}
```

**Lưu ý:**
- Public endpoint (không cần authentication)
- `gmailReady`: `true` nếu Gmail API đã được authenticate
- `queueStats`: Thống kê queue hiện tại

**Response:**
```json
[
  {
    "paymentId": "019a8f4a-bb0e-7402-a0c4-27647b89dc75",
    "bookingId": "019a8f4a-bb0e-7402-a0c4-27647b89dc74",
    "pnrCode": "XYZ789",
    "amount": 1577000,
    "currencyCode": "VND",
    "paymentMethodCode": "CREDIT_CARD",
    "paymentMethodName": "Credit Card",
    "status": "success",
    "transactionRef": "TXN123456789",
    "createdAt": "2025-11-20T10:15:00Z",
    "paidAt": "2025-11-20T10:15:05Z",
    "expiresAt": "2025-11-20T10:30:00Z",
    "paymentUrl": null
  }
]
```

---

## Flow 2: Round-Trip Booking (Chuyến khứ hồi)

### Step 1-2: Register & Login
Giống như Flow 1 (Step 1-2)

---

### Step 3: Search Flights (Round-Trip)

**Request (Round Trip - Auto tripType):**
```http
GET {{base_url}}/search/flights?origin=HAN&destination=SGN&departDate={{departDate}}&returnDate={{returnDate}}&adults=1&minors=0
```

**Request (Round Trip - Explicit tripType):**
```http
GET {{base_url}}/search/flights?origin=HAN&destination=SGN&departDate={{departDate}}&returnDate={{returnDate}}&tripType=round_trip&adults=1&minors=0
```

*Note: `tripType` là optional. Nếu không truyền, sẽ tự động set thành `round_trip` khi có `returnDate`.

**Response:**
```json
{
  "tripType": "round_trip",
  "outbound": [
    {
      "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
      "flightNumber": "VN123",
      "departureAirport": "HAN",
      "arrivalAirport": "SGN",
      "departureDateTime": "2025-11-20T08:00:00",
      "arrivalDateTime": "2025-11-20T10:00:00",
      ...
    }
  ],
  "inbound": [
    {
      "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc75",
      "flightNumber": "VN124",
      "departureAirport": "SGN",
      "arrivalAirport": "HAN",
      "departureDateTime": "2025-11-27T14:00:00",
      "arrivalDateTime": "2025-11-27T16:00:00",
      ...
    }
  ]
}
```

**Lưu ý:** 
- Lưu `flightInstanceId` từ `outbound[0]` vào `flightInstanceId`
- Lưu `flightInstanceId` từ `inbound[0]` vào `returnFlightInstanceId`

---

### Step 4: Get Fare Options (Outbound)

**Request:**
```http
GET {{base_url}}/search/fare-options?flightInstanceId={{flightInstanceId}}&cabinType=economy
```

Chọn fare class (VD: `YS`)

---

### Step 5: Get Fare Options (Inbound)

**Request:**
```http
GET {{base_url}}/search/fare-options?flightInstanceId={{returnFlightInstanceId}}&cabinType=economy
```

Chọn fare class (VD: `YS`)

---

### Step 6: Create Reservation (Round-Trip)

**Request:**
```http
POST {{base_url}}/reservations
Authorization: Bearer {{access_token}}
Content-Type: application/json

{
  "segments": [
    {
      "flightInstanceId": "{{flightInstanceId}}",
      "fareClassCode": "YS",
      "segmentType": "outbound"
    },
    {
      "flightInstanceId": "{{returnFlightInstanceId}}",
      "fareClassCode": "YS",
      "segmentType": "inbound"
    }
  ],
  "numberOfPassengers": 1,
  "currencyCode": "VND"
}
```

**Response:**
```json
{
  "reservationId": "019a8f4a-bb0e-7402-a0c4-27647b89dc76",
  "reservationCode": "DEF456",
  "segments": [
    {
      "segmentId": "019a8f4a-bb0e-7402-a0c4-27647b89dc77",
      "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
      "fareClassCode": "YS",
      "segmentType": "outbound",
      "baseFare": 1577000,
      "taxAmount": 0,
      "feeAmount": 0
    },
    {
      "segmentId": "019a8f4a-bb0e-7402-a0c4-27647b89dc78",
      "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc75",
      "fareClassCode": "YS",
      "segmentType": "inbound",
      "baseFare": 1577000,
      "taxAmount": 0,
      "feeAmount": 0
    }
  ],
  "numberOfPassengers": 1,
  "totalAmount": 3154000,
  "currencyCode": "VND",
  "status": "active",
  "expiresAt": "2025-11-20T10:15:00Z",
  "ttl": 900,
  "createdAt": "2025-11-20T10:00:00Z",
  "userId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71"
}
```

**Lưu ý:** 
- `totalAmount` = tổng của cả 2 segments (outbound + inbound)
- Frontend chỉ cần lưu 1 `reservationId` cho cả round-trip
- Reservation được lưu trong cả Database và Redis (Hybrid Approach)

---

### Step 7: Create Booking from Reservation (Round-Trip)

**Request:**
```http
POST {{base_url}}/bookings?reservationId={{reservationId}}
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

**Request Body - Passengers có 2 cách (giống như One-Way):**

#### **Option 1: Sử dụng Passenger đã có** (Tái sử dụng)
```json
{
  "passengers": [
    {
      "passengerId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",  // UUID v7 của passenger đã có
      "passengerType": "ADT"
    }
  ],
  "contactFullname": "Nguyen Van A",
  "contactEmail": "test@example.com",
  "contactPhone": "0901234567",
  "channel": "web"
}
```

#### **Option 2: Tạo Passenger mới** (Nhập thông tin mới)
```json
{
  "passengers": [
    {
      "passengerType": "ADT",              // Required: "ADT", "CHD", "INF"
      "fullname": "Nguyen Van A",          // Required: Tên đầy đủ
      "dob": "1990-01-15",                 // Required: Ngày sinh (YYYY-MM-DD)
      "gender": "Male",                    // Required: "Male" hoặc "Female"
      "documentNumber": "001234567890"     // Required: Số CMND/CCCD/Passport
    }
  ],
  "contactFullname": "Nguyen Van A",
  "contactEmail": "test@example.com",
  "contactPhone": "0901234567",
  "channel": "web"
}
```

**Lưu ý:** Xem giải thích chi tiết về Option 1 và Option 2 ở [Step 6 - One-Way Booking](#step-6-create-booking-from-reservation) phía trên.

**Response:**
```json
{
  "bookingId": "019a8f4a-bb0e-7402-a0c4-27647b89dc79",
  "pnrCode": "GHI012",
  "totalAmount": 3154000,
  "currencyCode": "VND",
  "status": "pending"
}
```

**Lưu ý:** 
- Backend tự động tạo booking segments từ tất cả reservation segments (outbound + inbound)
- Mỗi passenger sẽ có booking segments cho cả 2 chuyến bay

---

### Step 8-10: Get Booking Details & Process Payment
Giống như Flow 1 (Step 7-10)

---

## Flow 3: Additional Operations

### List Reservations

**Request:**
```http
GET {{base_url}}/reservations
Authorization: Bearer {{access_token}}
```

**Response:**
```json
[
  {
    "reservationId": "019a8f4a-bb0e-7402-a0c4-27647b89dc76",
    "reservationCode": "DEF456",
    "segments": [...],
    "totalAmount": 3154000,
    "status": "active",
    "expiresAt": "2025-11-20T10:15:00Z",
    ...
  }
]
```

**Lưu ý:** 
- Chỉ trả về reservations với status `active` và chưa expired
- Query từ Database, enrich với Redis cache (Hybrid Approach)

---

### Get Reservation by ID or Code

**Request:**
```http
GET {{base_url}}/reservations/{{reservationId}}
Authorization: Bearer {{access_token}}
```

Hoặc:

```http
GET {{base_url}}/reservations/code/{{reservationCode}}
Authorization: Bearer {{access_token}}
```

**Lưu ý:** 
- API tự động detect nếu input là UUID v7 (ID) hay 6 ký tự (code)
- Try Redis first → Fallback to Database → Re-cache if needed

---

### Cancel Reservation

**Request:**
```http
POST {{base_url}}/reservations/{{reservationId}}/cancel
Authorization: Bearer {{access_token}}
```

**Response:**
```json
{
  "success": true,
  "message": "Reservation cancelled successfully"
}
```

**Lưu ý:** 
- Update Database: status = 'cancelled'
- Delete from Redis

---

### Extend Reservation

**Request:**
```http
POST {{base_url}}/reservations/{{reservationId}}/extend
Authorization: Bearer {{access_token}}
Content-Type: application/json

{
  "additionalSeconds": 600
}
```

**Response:**
```json
{
  "reservationId": "019a8f4a-bb0e-7402-a0c4-27647b89dc76",
  "expiresAt": "2025-11-20T10:25:00Z",
  "ttl": 1500,
  ...
}
```

**Lưu ý:** 
- Update Database: expires_at = new expiration time
- Update Redis: SET with new TTL


## Flow 4: Guest Booking (Đặt vé không cần đăng nhập)

**Lưu ý:** Guest booking hiện tại vẫn cần đăng nhập để lưu booking state (cabin/seat). Trong tương lai có thể mở rộng để hỗ trợ guest booking state.

### Step 1: Search Flights (Public - không cần đăng nhập)

**Request:**
```http
GET {{base_url}}/api/v1/search/flights?origin=HAN&destination=SGN&departDate={{departDate}}&adults=1&minors=0
```

**Response:** Tương tự Flow 1

**Lưu ý:** Lưu `flightInstanceId` vào Postman variable

---

### Step 2: Login (Tạm thời cần để lưu booking state)

**Request:**
```http
POST {{base_url}}/api/v1/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "Password123!"
}
```

**Lưu ý:** Hiện tại guest booking state (cabin/seat) vẫn cần authentication. Trong tương lai có thể mở rộng.

---

### Step 3: Save Cabin Selection (Cần đăng nhập)

**Request:**
```http
POST {{base_url}}/api/v1/booking-state/cabin
Authorization: Bearer {{access_token}}
Content-Type: application/json

{
  "flightInstanceId": "{{flightInstanceId}}",
  "cabinType": "economy",
  "fareClassCode": "YS"
}
```

---

### Step 4: Save Seat Selection (Cần đăng nhập)

**Request:**
```http
POST {{base_url}}/api/v1/booking-state/seat
Authorization: Bearer {{access_token}}
Content-Type: application/json

{
  "flightInstanceId": "{{flightInstanceId}}",
  "flightSeatId": "{{flightSeatId}}",
  "seatNumber": "12A"
}
```

---

### Step 5: Create Reservation (Không cần đăng nhập - Optional auth)

**Request (Guest - không có token):**
```http
POST {{base_url}}/api/v1/reservations
Content-Type: application/json

{
  "segments": [
    {
      "flightInstanceId": "{{flightInstanceId}}",
      "segmentType": "outbound"
    }
  ],
  "numberOfPassengers": 1,
  "currencyCode": "VND"
}
```

**Request (Authenticated - có token):**
```http
POST {{base_url}}/api/v1/reservations
Authorization: Bearer {{access_token}}
Content-Type: application/json

{
  "segments": [
    {
      "flightInstanceId": "{{flightInstanceId}}",
      "segmentType": "outbound"
    }
  ],
  "numberOfPassengers": 1,
  "currencyCode": "VND"
}
```

**Response:**
```json
{
  "reservationId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "reservationCode": "ABC123",
  "totalAmount": 1577000,
  "expiresAt": "2025-11-20T15:30:00Z",
  "ttl": 900
}
```

**Lưu ý:** 
- Lưu `reservationId` vào Postman variable
- Reservation có thể được tạo với hoặc không có `userId` (tùy vào có token hay không)

---

### Step 6: Create Booking (Không cần đăng nhập - Optional auth)

**Request (Guest - không có token, contact info BẮT BUỘC):**
```http
POST {{base_url}}/api/v1/bookings?reservationId={{reservationId}}
Content-Type: application/json

{
  "passengers": [
    {
      "passengerType": "ADT",
      "fullname": "Nguyen Van A",
      "dob": "1990-01-15",
      "gender": "Male",
      "documentNumber": "001234567890"
    }
  ],
  "contactFullname": "Nguyen Van A",
  "contactEmail": "guest@example.com",
  "contactPhone": "0912345678",
  "channel": "web"
}
```

**Request (Authenticated - có token, contact info OPTIONAL):**
```http
POST {{base_url}}/api/v1/bookings?reservationId={{reservationId}}
Authorization: Bearer {{access_token}}
Content-Type: application/json

{
  "passengers": [
    {
      "passengerId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
      "passengerType": "ADT"
    }
  ],
  "channel": "web"
}
```

**Response:**
```json
{
  "bookingId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "pnrCode": "ABC123",
  "totalAmount": 1577000,
  "currencyCode": "VND",
  "status": "pending"
}
```

**Lưu ý:**
- **Guest bookings**: Contact info là BẮT BUỘC, không thể dùng `passengerId`
- **Authenticated bookings**: Contact info là OPTIONAL, có thể dùng `passengerId`
- Lưu `bookingId` vào Postman variable

---

### Step 7: Process Payment (Optional auth)

**Request (Guest - không có token):**
```http
POST {{base_url}}/api/v1/payments/bookings/{{bookingId}}/process
Content-Type: application/json

{
  "paymentMethodCode": "dev",
  "amount": 1577000
}
```

**Request (Authenticated - có token):**
```http
POST {{base_url}}/api/v1/payments/bookings/{{bookingId}}/process
Authorization: Bearer {{access_token}}
Content-Type: application/json

{
  "paymentMethodCode": "dev",
  "amount": 1577000
}
```

**Response:**
```json
{
  "paymentId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "status": "completed",
  "bookingId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71"
}
```

**Lưu ý:**
- Sau khi thanh toán thành công, tickets được tạo tự động
- Email ticket confirmation được gửi tự động đến `contact_email` trong booking

---

## Flow 5: Guest Booking với X-Session-Id (Không cần đăng nhập - Full Guest Flow)

**Lưu ý:** Flow này test guest booking hoàn toàn không cần đăng nhập, sử dụng `X-Session-Id` header để quản lý booking state (cabin/seat) cho guest users.

### Step 1: Search Flights (Public - không cần đăng nhập)

**Request:**
```http
GET {{base_url}}/api/v1/search/flights?origin=HAN&destination=SGN&departDate={{departDate}}&adults=1&minors=0
```

**Response:** Tương tự Flow 1

**Lưu ý:** 
- Lưu `flightInstanceId` vào Postman variable `{{flightInstanceId}}`
- Chọn flight instance có `availableSeats > 0`

**Postman Test Script (Optional - để auto-set variable):**
```javascript
let res = pm.response.json();
let fi = res.outbound && res.outbound[0];
if (fi && fi.flightInstanceId) {
  pm.collectionVariables.set("flightInstanceId", fi.flightInstanceId);
}
```

---

### Step 2: Save Cabin Selection (Guest - lấy sessionId từ response)

**Request:**
```http
POST {{base_url}}/api/v1/booking-state/cabin
Content-Type: application/json

{
  "flightInstanceId": "{{flightInstanceId}}",
  "cabinType": "economy",
  "fareClassCode": "YS"
}
```

**Lưu ý:** 
- **KHÔNG gửi** `Authorization` header (guest user)
- **KHÔNG gửi** `X-Session-Id` header ở request đầu tiên (backend sẽ tự generate)

**Response:**
```json
{
  "success": true,
  "message": "Cabin selection saved successfully",
  "sessionId": "019adf90-c4c0-7270-bece-d30871b28cd8"
}
```

**Postman Test Script (BẮT BUỘC - để lưu sessionId):**
```javascript
let data = pm.response.json();
if (data.sessionId) {
  pm.collectionVariables.set("sessionId", data.sessionId);
}
```

**Lưu ý:** 
- Lưu `sessionId` từ response vào Postman variable `{{sessionId}}`
- `sessionId` này sẽ được dùng cho tất cả các request tiếp theo trong flow guest

---

### Step 3: Get Seat Map (Optional - để chọn ghế)

**Request:**
```http
GET {{base_url}}/api/v1/search/seats?flightInstanceId={{flightInstanceId}}&cabinType=economy
```

**Response:** Array of seats với `flightSeatId`, `seatNumber`, `isAvailable`, etc.

**Lưu ý:** 
- Chọn một seat có `isAvailable: true`
- Lưu `flightSeatId` và `seatNumber` vào Postman variables

**Postman Test Script (Optional):**
```javascript
let seats = pm.response.json();
if (Array.isArray(seats) && seats.length > 0) {
  // Chọn seat đầu tiên có sẵn
  let availableSeat = seats.find(s => s.isAvailable) || seats[0];
  pm.collectionVariables.set("flightSeatId", availableSeat.flightSeatId);
  pm.collectionVariables.set("seatNumber", availableSeat.seatNumber);
}
```

---

### Step 4: Save Seat Selection (Guest - dùng X-Session-Id)

**Request:**
```http
POST {{base_url}}/api/v1/booking-state/seat
X-Session-Id: {{sessionId}}
Content-Type: application/json

{
  "flightInstanceId": "{{flightInstanceId}}",
  "flightSeatId": "{{flightSeatId}}",
  "seatNumber": "{{seatNumber}}"
}
```

**Lưu ý:** 
- **KHÔNG gửi** `Authorization` header (vẫn là guest)
- **BẮT BUỘC gửi** `X-Session-Id: {{sessionId}}` header (lấy từ Step 2)
- Seat phải thuộc đúng cabin class đã chọn ở Step 2

**Response:**
```json
{
  "success": true,
  "message": "Seat selection saved successfully",
  "sessionId": "019adf90-c4c0-7270-bece-d30871b28cd8"
}
```

---

### Step 5: Create Reservation (Guest - dùng X-Session-Id)

**Request:**
```http
POST {{base_url}}/api/v1/reservations
X-Session-Id: {{sessionId}}
Content-Type: application/json

{
  "segments": [
    {
      "flightInstanceId": "{{flightInstanceId}}",
      "segmentType": "outbound"
    }
  ],
  "numberOfPassengers": 1,
  "currencyCode": "VND"
}
```

**Lưu ý:** 
- **KHÔNG gửi** `Authorization` header (guest user)
- **BẮT BUỘC gửi** `X-Session-Id: {{sessionId}}` header
- Backend sẽ tự động lấy `fareClassCode` và `flightSeatId` từ booking state (Redis) dựa trên `sessionId`

**Response:**
```json
{
  "reservationId": "019adf91-ed6e-7190-9f3a-4e72629e7778",
  "reservationCode": "6EY46B",
  "segments": [
    {
      "segmentId": "019adf91-ed6c-732e-bf23-c3ecd6130d25",
      "flightInstanceId": "019AD9AA-2362-7329-B631-B7BFF432B78F",
      "fareClassCode": "YS",
      "segmentType": "outbound",
      "baseFare": 1577000,
      "taxAmount": 0,
      "feeAmount": 0,
      "flightSeatId": "019AD9AA-3603-7549-A62D-E595015F800F",
      "seatNumber": "3C"
    }
  ],
  "numberOfPassengers": 1,
  "totalAmount": 1577000,
  "currencyCode": "VND",
  "status": "active",
  "expiresAt": "2025-12-02T15:40:19.874Z",
  "ttl": 900
}
```

**Postman Test Script (BẮT BUỘC):**
```javascript
let data = pm.response.json();
if (data.reservationId) {
  pm.collectionVariables.set("reservationId", data.reservationId);
}
```

**Lưu ý:** 
- Lưu `reservationId` vào Postman variable
- Reservation expire sau 15 phút (900 seconds)
- Booking state (cabin/seat) sẽ tự động được xóa sau khi tạo reservation thành công

---

### Step 6: Create Booking (Guest - không cần X-Session-Id)

**Request:**
```http
POST {{base_url}}/api/v1/bookings?reservationId={{reservationId}}
Content-Type: application/json

{
  "passengers": [
    {
      "passengerType": "ADT",
      "fullname": "Nguyen Van A",
      "dob": "1990-01-15",
      "gender": "Male",
      "documentNumber": "001234567890"
    }
  ],
  "contactFullname": "Nguyen Van A",
  "contactEmail": "guest@example.com",
  "contactPhone": "0912345678",
  "channel": "web"
}
```

**Lưu ý:** 
- **KHÔNG gửi** `Authorization` header (guest user)
- **KHÔNG cần** `X-Session-Id` header (reservation đã chứa toàn bộ thông tin cần thiết)
- **Contact info là BẮT BUỘC** cho guest bookings
- **Không thể dùng** `passengerId` (phải cung cấp đầy đủ thông tin passenger)

**Response:**
```json
{
  "bookingId": "019adf97-0941-75f1-a753-b769b5a11d8a",
  "pnrCode": "ML1T4I",
  "totalAmount": 1577000,
  "currencyCode": "VND",
  "status": "pending"
}
```

**Postman Test Script (BẮT BUỘC):**
```javascript
let data = pm.response.json();
if (data.bookingId) {
  pm.collectionVariables.set("bookingId", data.bookingId);
  pm.collectionVariables.set("totalAmount", data.totalAmount);
}
```

**Lưu ý:** 
- Lưu `bookingId` và `totalAmount` vào Postman variables
- Reservation status sẽ tự động update thành `converted`
- Booking sẽ có `user_id = null` (guest booking)

---

### Step 7: Process Payment (Guest - với idempotency key)

**Request:**
```http
POST {{base_url}}/api/v1/payments/bookings/{{bookingId}}/process
Content-Type: application/json

{
  "paymentMethodCode": "CREDIT_CARD",
  "transactionRef": "TXN123456789",
  "idempotencyKey": "abc",
  "amount": {{totalAmount}}
}
```

**Lưu ý:** 
- **KHÔNG gửi** `Authorization` header (guest user)
- **KHÔNG cần** `X-Session-Id` header
- `idempotencyKey` là optional nhưng **nên dùng** để prevent duplicate payments
- `amount` phải bằng `totalAmount` của booking

**Response:**
```json
{
  "paymentId": "019ADFAB-0482-7329-97C0-92851620F821",
  "bookingId": "019adf97-0941-75f1-a753-b769b5a11d8a",
  "pnrCode": "ML1T4I",
  "amount": 1577000,
  "currencyCode": "VND",
  "paymentMethodCode": "CREDIT_CARD",
  "paymentMethodName": "Credit Card",
  "status": "pending",
  "transactionRef": "019ADFAB-0A82-7329-97C0-92851620F821",
  "createdAt": "2025-12-02T15:25:19.877Z",
  "paidAt": null
}
```

**Postman Test Script (BẮT BUỘC):**
```javascript
let data = pm.response.json();
if (data.paymentId) {
  pm.collectionVariables.set("paymentId", data.paymentId);
}
```

**Lưu ý:** 
- Lưu `paymentId` vào Postman variable
- Payment status = `pending` (sẽ được update thành `success` sau khi payment gateway xử lý)
- Booking status sẽ tự động update thành `paid` khi payment thành công
- Tickets sẽ được tạo tự động sau khi payment thành công
- Email confirmation sẽ được gửi đến `contactEmail` trong booking

---

## 🔄 Payment Flow: Từ Pending → Success

### Trong Production (Real Payment Gateway):

1. **User tạo payment** → `POST /payments/bookings/:bookingId/process`
   - Backend tạo Payment record với `status = "pending"`
   - Backend gọi Payment Gateway API → nhận `transactionId` và `paymentUrl`
   - Backend trả về `paymentUrl` cho frontend

2. **User redirect đến Payment Gateway** (VNPay, MoMo, Stripe, etc.)
   - User nhập thông tin thẻ/account và thanh toán
   - Payment Gateway xử lý payment

3. **Payment Gateway gửi Webhook về Backend**
   - Payment Gateway gọi `POST /api/v1/payments/webhook` (hoặc endpoint tương tự)
   - Backend xử lý webhook → `handleWebhook()` → tự động update `status = "success"`
   - Backend tự động update booking `status = "paid"`
   - Backend tạo tickets qua RabbitMQ queue

### Trong Testing/Development (Mock Payment Gateway):

⚠️ **Vấn đề**: Mock Payment Gateway **KHÔNG tự động gửi webhook** về backend!

**Flow hiện tại:**
1. **User tạo payment** → `POST /payments/bookings/:bookingId/process`
   - Backend tạo Payment record với `status = "pending"`
   - Backend gọi Mock Payment Gateway → nhận `transactionId` và `paymentUrl`
   - **Payment vẫn ở trạng thái `pending`** (vì không có webhook tự động)

2. **Cần manually update payment status**:
   - Gọi `PATCH /api/v1/payments/:paymentId/status` với `status = "success"`
   - Backend update payment `status = "success"` và `paidAt = now()`
   - Backend tự động update booking `status = "paid"`
   - Backend tạo tickets qua RabbitMQ queue

**Tại sao cần Step 12 (Update Payment Status)?**
- Trong testing/development, không có real payment gateway webhook
- Cần manually simulate payment success để test full flow
- Trong production, step này sẽ được thay thế bởi payment gateway webhook

---

### Step 8: Test Idempotency (Optional - verify idempotency key hoạt động)

**Request (Gửi lại Step 7 với cùng idempotencyKey):**
```http
POST {{base_url}}/api/v1/payments/bookings/{{bookingId}}/process
Content-Type: application/json

{
  "paymentMethodCode": "CREDIT_CARD",
  "transactionRef": "TXN123456789",
  "idempotencyKey": "abc",
  "amount": {{totalAmount}}
}
```

**Expected Response:**
- **Cùng `paymentId`** như Step 7 (không tạo payment mới)
- **Cùng `transactionRef`** như Step 7
- Status code: `200 OK` hoặc `201 Created` (tùy implementation)

**Lưu ý:** 
- Idempotency key hoạt động dựa trên cặp (`bookingId`, `idempotencyKey`)
- Nếu gửi cùng cặp này nhiều lần, backend sẽ trả về cùng payment (không tạo duplicate)
- Idempotency check: Redis first (fast) → DB fallback (guarantee)

---

### Step 9: Verify Payment (Optional - xem payment details)

**Request:**
```http
GET {{base_url}}/api/v1/payments/{{paymentId}}
```

**Lưu ý:** 
- **KHÔNG cần** `Authorization` header (guest có thể xem payment của booking của họ)
- Endpoint hỗ trợ guest users (OptionalJwtAuthGuard)

**Response:** Payment details với đầy đủ thông tin

---

### Step 10: Get Payments by Booking (Optional - xem tất cả payments của booking)

**Request:**
```http
GET {{base_url}}/api/v1/payments/bookings/{{bookingId}}
```

**Lưu ý:** 
- **KHÔNG cần** `Authorization` header (guest có thể xem payments của booking của họ)
- Endpoint hỗ trợ guest users (OptionalJwtAuthGuard)

**Response:** Array of payments cho booking đó

---

### Step 11: Verify Booking Status (Verify booking đã được update thành 'paid')

**Request:**
```http
GET {{base_url}}/api/v1/bookings/{{bookingId}}/payment-info
```

**Lưu ý:** 
- **KHÔNG cần** `Authorization` header (public endpoint)
- Endpoint này trả về thông tin payment của booking

**Response:**
```json
{
  "bookingId": "019adf97-0941-75f1-a753-b769b5a11d8a",
  "pnrCode": "ML1T4I",
  "totalAmount": 1577000,
  "currencyCode": "VND",
  "contactFullname": "Nguyen Van A",
  "contactEmail": "guest@example.com",
  "contactPhone": "0912345678",
  "status": "paid"
}
```

**Lưu ý:** 
- Verify `status` = `"paid"` (booking đã được thanh toán thành công)
- Sau khi payment thành công, booking status sẽ tự động update thành `paid`
- Tickets sẽ được tạo tự động qua RabbitMQ queue (async processing)

---

### Step 12: Update Payment Status (BẮT BUỘC trong Testing - Update payment từ pending → success)

**QUAN TRỌNG:** 
- **Trong Testing/Development**: Đây là step **BẮT BUỘC** vì Mock Payment Gateway không tự động gửi webhook
- **Trong Production**: Step này **KHÔNG CẦN** vì Payment Gateway sẽ tự động gửi webhook về backend
- **SECURITY**: Endpoint này yêu cầu JWT authentication - chỉ authenticated users hoặc system (webhook) có thể update payment status
- **Guest users KHÔNG THỂ update payment status trực tiếp** - đây là security best practice để prevent unauthorized payment status updates
- Trước khi verify payment success, bạn cần update payment status từ `pending` → `success`!

**Request:**
```http
PATCH {{base_url}}/api/v1/payments/{{paymentId}}/status
Authorization: Bearer {{access_token}}
Content-Type: application/json

{
  "status": "success",
  "transactionRef": "{{transactionRef}}"
}
```

**Lưu ý:** 
- **BẮT BUỘC** `Authorization: Bearer {{access_token}}` header (JWT authentication required)
- **Guest users**: Nếu test guest flow, bạn có 2 options:

  **Option 1: Dùng Webhook Endpoint (KHUYẾN NGHỊ - giống FE đang làm):**
  ```http
  POST {{base_url}}/api/v1/payments/webhooks/dev
  Content-Type: application/json
  
  {
    "paymentId": "{{paymentId}}",
    "status": "success"
  }
  ```
  - **KHÔNG cần** `Authorization` header (webhook endpoint không yêu cầu auth)
  - Đây là cách FE đang dùng để simulate payment gateway webhook
  - Phù hợp với production flow (payment gateway gửi webhook về backend)

  **Option 2: Dùng Authenticated User:**
  - Tạo một test user account và login để lấy `access_token`
  - Dùng `access_token` để gọi `PATCH /payments/:id/status`
  - Chỉ có thể update payment của chính user đó (ownership check)

- Sau khi update status = `success`, `paidAt` sẽ được tự động set
- Booking status sẽ tự động update thành `paid` khi payment thành công
- **Security**: Chỉ authenticated users hoặc webhook (system) có thể update payment status

**Expected Response:**
```json
{
  "paymentId": "019ADFAB-0482-7329-97C0-92851620F821",
  "bookingId": "019adf97-0941-75f1-a753-b769b5a11d8a",
  "pnrCode": "ML1T4I",
  "amount": 1577000,
  "currencyCode": "VND",
  "paymentMethodCode": "CREDIT_CARD",
  "paymentMethodName": "Credit Card",
  "status": "success",
  "transactionRef": "019ADFAB-0A82-7329-97C0-92851620F821",
  "createdAt": "2025-12-02T15:25:19.877Z",
  "paidAt": "2025-12-02T15:25:20.123Z"
}
```

**Postman Test Script (Optional - để verify update thành công):**
```javascript
// Check response status code
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

// Parse JSON response safely
let jsonData;
try {
    jsonData = pm.response.json();
} catch (e) {
    pm.expect.fail("Response is not valid JSON: " + pm.response.text());
}

// Verify payment status is success
pm.test("Payment status updated to success", function () {
    pm.expect(jsonData).to.have.property('status');
    pm.expect(jsonData.status).to.equal("success");
});

// Verify payment has paidAt timestamp
pm.test("Payment has paidAt timestamp after update", function () {
    pm.expect(jsonData).to.have.property('paidAt');
    pm.expect(jsonData.paidAt).to.not.be.null;
    pm.expect(jsonData.paidAt).to.be.a('string');
});
```

---

### Step 12b: Update Payment Status via Webhook (KHUYẾN NGHỊ cho Guest Flow)

⚠️ **KHUYẾN NGHỊ cho Guest Flow**: Dùng webhook endpoint thay vì `PATCH /payments/:id/status` vì:
- ✅ Không cần JWT authentication
- ✅ Giống với production flow (payment gateway gửi webhook)
- ✅ FE đang dùng cách này để simulate payment gateway

**Request:**
```http
POST {{base_url}}/api/v1/payments/webhooks/dev
Content-Type: application/json

{
  "paymentId": "{{paymentId}}",
  "status": "success"
}
```

**Lưu ý:** 
- **KHÔNG cần** `Authorization` header (webhook endpoint không yêu cầu auth)
- `gateway` trong URL là `dev` (development gateway)
- `status` có thể là `"success"` hoặc `"failed"`
- Webhook sẽ tự động:
  1. Tìm payment theo `paymentId`
  2. Update payment status
  3. Update booking status thành `paid` (nếu success)
  4. Tạo tickets qua RabbitMQ queue

**Expected Response:**
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

**Postman Test Script (Optional):**
```javascript
// Check response status code
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

// Parse JSON response safely
let jsonData;
try {
    jsonData = pm.response.json();
} catch (e) {
    pm.expect.fail("Response is not valid JSON: " + pm.response.text());
}

// Verify webhook processed successfully
pm.test("Webhook processed successfully", function () {
    pm.expect(jsonData).to.have.property('success');
    pm.expect(jsonData.success).to.be.true;
});
```

---

### Step 13: Verify Payment Status (Verify payment đã được process thành công)

**Request:**
```http
GET {{base_url}}/api/v1/payments/{{paymentId}}
```

**Lưu ý:** 
- **KHÔNG cần** `Authorization` header (guest có thể xem payment của booking của họ)
- Endpoint hỗ trợ guest users (OptionalJwtAuthGuard)

**Expected Response:**
```json
{
  "paymentId": "019ADFAB-0482-7329-97C0-92851620F821",
  "bookingId": "019adf97-0941-75f1-a753-b769b5a11d8a",
  "pnrCode": "ML1T4I",
  "amount": 1577000,
  "currencyCode": "VND",
  "paymentMethodCode": "CREDIT_CARD",
  "paymentMethodName": "Credit Card",
  "status": "success",
  "transactionRef": "019ADFAB-0A82-7329-97C0-92851620F821",
  "createdAt": "2025-12-02T15:25:19.877Z",
  "paidAt": "2025-12-02T15:25:20.123Z"
}
```

**Postman Test Script (BẮT BUỘC - Verify Payment Success):**

⚠️ **QUAN TRỌNG:** Script này phải đặt trong tab **"Post-response"** (hoặc **"Tests"**), KHÔNG phải **"Pre-request"**!

- **Pre-request script**: Chạy TRƯỚC khi gửi request → không có `pm.response` → dùng để set variables, headers, body
- **Post-response script**: Chạy SAU khi nhận response → có `pm.response` → dùng để verify response

```javascript
// ⚠️ ĐẶT SCRIPT NÀY VÀO TAB "Post-response" (Tests), KHÔNG PHẢI "Pre-request"!

// Check response status code
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

// Parse JSON response safely
let jsonData;
try {
    jsonData = pm.response.json();
} catch (e) {
    pm.expect.fail("Response is not valid JSON: " + pm.response.text());
}

// Verify payment status is success
pm.test("Payment status is success", function () {
    pm.expect(jsonData).to.have.property('status');
    pm.expect(jsonData.status).to.equal("success");
});

// Verify payment has paidAt timestamp
pm.test("Payment has paidAt timestamp", function () {
    pm.expect(jsonData).to.have.property('paidAt');
    pm.expect(jsonData.paidAt).to.not.be.null;
    pm.expect(jsonData.paidAt).to.be.a('string');
});

// Verify payment has required fields
pm.test("Payment has all required fields", function () {
    pm.expect(jsonData).to.have.property('paymentId');
    pm.expect(jsonData).to.have.property('bookingId');
    pm.expect(jsonData).to.have.property('amount');
    pm.expect(jsonData).to.have.property('currencyCode');
    pm.expect(jsonData).to.have.property('paymentMethodCode');
    pm.expect(jsonData).to.have.property('status');
});
```

**Lưu ý:** 
- ✅ **Đặt script trong tab "Post-response"** (Tests) - script chạy SAU khi nhận response
- ❌ **KHÔNG đặt script trong tab "Pre-request"** - sẽ gây lỗi `TypeError: Cannot read properties of undefined (reading 'text')`
- Verify `status` = `"success"` (payment đã được xử lý thành công)
- Verify `paidAt` không null (thời điểm payment thành công)
- Payment status sẽ được update từ `pending` → `success` sau khi payment gateway xử lý
- Test script sử dụng try-catch để parse JSON an toàn, tránh lỗi `TypeError`

---

### Step 13: Verify Email Confirmation (Optional - check email đã được gửi)

**Lưu ý:** 
- Email confirmation sẽ được gửi tự động đến `contactEmail` trong booking sau khi payment thành công
- Email được gửi qua RabbitMQ queue (async, non-blocking)
- Email chứa thông tin booking, payment, và ticket details

**Cách verify:**
- Check email inbox của `contactEmail` (guest@example.com)
- Hoặc check RabbitMQ queue `email_notifications` trong RabbitMQ Management UI (`http://localhost:15672`)
- Hoặc check logs của Email Microservice

---

### Step 14: Verify Tickets Created (Optional - check tickets đã được tạo)

**Lưu ý:** 
- Tickets sẽ được tạo tự động sau khi payment thành công
- Ticket creation được xử lý qua RabbitMQ queue `ticket_creation` (async processing)
- Mỗi passenger trong booking sẽ có 1 ticket tương ứng

**Cách verify:**
- Check database table `Tickets` với `booking_id = {{bookingId}}`
- Hoặc check RabbitMQ queue `ticket_creation` trong RabbitMQ Management UI
- Hoặc check logs của Booking Microservice

**SQL Query (Optional):**
```sql
SELECT * FROM Tickets WHERE booking_id = '{{bookingId}}'
```

**Expected:** 
- Số lượng tickets = số lượng passengers trong booking
- Mỗi ticket có `ticket_number`, `pnr_code`, `passenger_id`, `booking_segment_id`, etc.

---

## Next Steps

Sau khi test thành công:
1. Verify data trong Database (Reservations table)
2. Verify data trong Redis (reservation keys)
3. Check reservation status transitions
4. Test error cases (expired, cancelled, not found)
5. Test Hybrid Approach (Redis down scenario)
6. **Test Guest Booking**: Verify booking và passengers có `user_id = null`
7. **Test Authenticated Booking**: Verify booking và passengers có `user_id` được set đúng
8. **Test Idempotency**: Verify cùng `idempotencyKey` + `bookingId` trả về cùng `paymentId`
9. **Test X-Session-Id Flow**: Verify guest có thể complete full booking flow mà không cần login

