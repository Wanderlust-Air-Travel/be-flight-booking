# API Testing Flow - Hướng dẫn Test API theo Flow

Tài liệu này hướng dẫn test API theo flow đầy đủ từ đầu đến cuối, bao gồm cả one-way và round-trip booking.

---

## Prerequisites

### 1. Start Services
```bash
# Start Redis
docker-compose up -d redis

# Start API Gateway
npm run start:dev

# Start Microservices (mỗi terminal riêng)
npm run start:search:dev        # Port 4001
npm run start:services:dev      # Port 4002
npm run start:routes:dev        # Port 4003
npm run start:booking:dev       # Port 4004
npm run start:reservation:dev   # Port 4005
```

### 2. Run Database Migrations
```bash
# Chạy migrations để tạo Reservations table (nếu chưa có)
npm run migration:run

# Kiểm tra trạng thái migrations
npm run migration:show
```

**Lưu ý:** Migration `AddReservationsTable` sẽ tạo bảng `Reservations` với đầy đủ indexes và foreign keys.

### 3. Seed Database
```bash
npm run seed:full
```

### 4. Setup Postman Collection
- Import file: `tools/Flight-Booking-API.postman_collection.json`
- Set collection variables:
  - `base_url`: `http://localhost:3000`
  - `departDate`: Ngày trong khoảng 60 ngày từ hôm nay (VD: `2025-11-20`)
  - `returnDate`: Ngày sau departDate (VD: `2025-11-27`)

---

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

**Request:**
```http
GET {{base_url}}/search/flights?origin=HAN&destination=SGN&departDate={{departDate}}&tripType=one_way&adults=1&minors=0
```

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

## Flow 2: Round-Trip Booking (Chuyến khứ hồi)

### Step 1-2: Register & Login
Giống như Flow 1 (Step 1-2)

---

### Step 3: Search Flights (Round-Trip)

**Request:**
```http
GET {{base_url}}/search/flights?origin=HAN&destination=SGN&departDate={{departDate}}&returnDate={{returnDate}}&tripType=round_trip&adults=1&minors=0
```

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

### Step 8-9: Get Booking Details
Giống như Flow 1 (Step 7-8)

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

---

## Testing Checklist

### One-Way Booking Flow
- [ ] Register user
- [ ] Login và lấy access_token
- [ ] Search flights (one-way)
- [ ] Get fare options
- [ ] Create reservation (1 segment - outbound)
- [ ] Verify reservation trong Database và Redis
- [ ] Create booking from reservation
- [ ] Verify reservation status = 'converted' trong Database
- [ ] Verify reservation deleted từ Redis
- [ ] Get booking fare details
- [ ] Get booking payment info

### Round-Trip Booking Flow
- [ ] Register user
- [ ] Login và lấy access_token
- [ ] Search flights (round-trip)
- [ ] Get fare options (outbound)
- [ ] Get fare options (inbound)
- [ ] Create reservation (2 segments - outbound + inbound)
- [ ] Verify reservation trong Database và Redis
- [ ] Verify totalAmount = sum of both segments
- [ ] Create booking from reservation
- [ ] Verify booking có 2 segments (outbound + inbound)
- [ ] Verify reservation status = 'converted' trong Database
- [ ] Get booking details

### Additional Operations
- [ ] List reservations
- [ ] Get reservation by ID
- [ ] Get reservation by code
- [ ] Cancel reservation
- [ ] Extend reservation
- [ ] Verify Hybrid Approach (Redis down → fallback to Database)

---

## Common Issues & Solutions

### Issue 0: Table 'Reservations' does not exist
**Nguyên nhân:** Chưa chạy migration để tạo bảng Reservations
**Giải pháp:** 
```bash
# Đảm bảo SQL Server đang chạy và database đã được tạo
# Kiểm tra .env file có đúng DB credentials không

# Chạy migrations
npm run migration:run

# Kiểm tra migrations đã chạy
npm run migration:show
```

**Nếu gặp lỗi "Login failed for user 'sa'":**
- Kiểm tra SQL Server đang chạy
- Kiểm tra credentials trong `.env` file (DB_USER, DB_PASS, DB_NAME)
- Đảm bảo database đã được tạo
- Thử connect bằng SQL Server Management Studio để verify credentials

### Issue 0.1: Entity metadata for Currency#reservations was not found
**Nguyên nhân:** Seed script chưa include Reservation entity
**Giải pháp:** 
- Đã fix trong code - Reservation entity đã được thêm vào seed script
- Chạy lại: `npm run seed:full`

### Issue 1: Reservation not found
**Nguyên nhân:** Reservation đã expire hoặc không tồn tại
**Giải pháp:** 
- Check `expiresAt` trong response
- Tạo reservation mới
- Nếu Redis down, reservation vẫn có thể lấy từ Database (Hybrid Approach)

### Issue 2: Not enough available seats
**Nguyên nhân:** Số ghế available < numberOfPassengers
**Giải pháp:** 
- Chọn flight instance khác có nhiều available seats hơn
- Giảm numberOfPassengers

### Issue 3: Reservation expired
**Nguyên nhân:** Reservation đã quá 15 phút
**Giải pháp:** 
- Tạo reservation mới
- Hoặc extend reservation trước khi tạo booking

### Issue 4: Invalid reservation status
**Nguyên nhân:** Reservation đã bị cancel hoặc converted
**Giải pháp:** 
- Check reservation status trong Database
- Tạo reservation mới

---

## Notes

1. **Hybrid Approach**: Reservation được lưu trong cả Database và Redis
   - Database: Persistent storage, audit trail, analytics
   - Redis: Fast cache với TTL 15 phút
   - Get Flow: Try Redis first → Fallback to Database → Re-cache

2. **Reservation Status**:
   - `pending`: Trong Database (chưa expire)
   - `active`: Trong Redis (chưa expire)
   - `expired`: Đã quá thời gian
   - `converted`: Đã tạo booking
   - `cancelled`: Đã bị hủy

3. **Multi-Segment Support**:
   - One-way: 1 segment với `segmentType: 'outbound'`
   - Round-trip: 1 reservation với 2 segments (outbound + inbound)
   - Frontend chỉ cần lưu 1 `reservationId`

4. **Booking Creation**:
   - `reservationId` query parameter là **REQUIRED**
   - Direct booking without reservation không còn được hỗ trợ
   - Backend tự động lấy tất cả segments từ reservation

---

## Postman Collection Variables

Sau khi chạy các requests, Postman collection sẽ tự động set các variables:

- `access_token`: JWT access token
- `flightInstanceId`: Flight instance ID cho outbound
- `returnFlightInstanceId`: Flight instance ID cho inbound (round-trip)
- `reservationId`: Reservation ID
- `reservationCode`: Reservation code (6 alphanumeric)
- `bookingId`: Booking ID
- `departDate`: Departure date (YYYY-MM-DD)
- `returnDate`: Return date (YYYY-MM-DD)

---

## Next Steps

Sau khi test thành công:
1. Verify data trong Database (Reservations table)
2. Verify data trong Redis (reservation keys)
3. Check reservation status transitions
4. Test error cases (expired, cancelled, not found)
5. Test Hybrid Approach (Redis down scenario)

