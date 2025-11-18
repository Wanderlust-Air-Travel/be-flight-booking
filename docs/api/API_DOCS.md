# API Documentation - Flight Booking Backend

## Base URL

```
http://localhost:3000
```

**Swagger UI**: `http://localhost:3000/api-docs` (Interactive API documentation)

## Important Notes

### Authentication
- **Booking APIs** (`POST /bookings`, `GET /bookings/:id/*`, `PATCH /bookings/:id/*`) yêu cầu JWT authentication
- **Reservation APIs** (`POST /reservations`, `GET /reservations`, `GET /reservations/:id`, `POST /reservations/:id/cancel`, `POST /reservations/:id/extend`) yêu cầu JWT authentication
- Gửi JWT token trong header: `Authorization: Bearer <access_token>`
- `userId` không cần truyền trong request body - tự động extract từ JWT token

### UUID v7
- Tất cả IDs trong hệ thống sử dụng **UUID v7** (time-ordered UUID)
- Format: `xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx` (chữ số `7` ở vị trí version)
- UUID v7 có thể sắp xếp theo thời gian, tốt cho database indexing
- User IDs được tự động generate là UUID v7 khi đăng ký

### Reservation Service (Backend-managed State)
- **Reservation** là temporary state được lưu trong **Redis** (không phải database)
- Reservation tự động expire sau 15 phút (configurable)
- Backend quản lý state thay vì frontend - đảm bảo tính nhất quán
- Flow: Search → Fare Options → **Create Reservation** → Create Booking from Reservation
- Reservation giúp giữ chỗ tạm thời và lock giá trước khi tạo booking

### Passenger Creation
- `passengerId` là optional trong booking request
- Nếu không có `passengerId`, có thể tạo passenger mới từ thông tin trong request
- Passenger mới tự động link với user (từ JWT) để tái sử dụng sau này
- Tự động detect và reuse passenger nếu cùng `documentNumber` đã tồn tại cho user

---

## Authentication

### Register (Đăng ký)

**POST** `/auth/register`

**Request Body:**
```json
{
  "fullname": "Nguyen Van A",
  "email": "user@example.com",
  "password": "StrongP@ssw0rd",
  "phone": "0901234567"
}
```

**Validation:**
- `fullname`: 2-100 characters, required
- `email`: Valid email format, required
- `password`: 6-20 characters, required
- `phone`: Valid Vietnamese phone number, required

**Response (201 Created):**
```json
{
  "user": {
    "id": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
    "fullname": "Nguyen Van A",
    "email": "user@example.com",
    "phone": "0901234567"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Lưu ý về UUID v7:**
- `user.id` (user_id) được tự động generate là **UUID v7** (time-ordered UUID)
- UUID v7 format: `xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx` (chữ số `7` ở vị trí version)
- UUID v7 có thể sắp xếp theo thời gian, phù hợp cho database indexing
- Tất cả user IDs trong hệ thống đều sử dụng UUID v7

**Error (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": ["email must be an email", "password must be longer than or equal to 6 characters"],
  "error": "Bad Request"
}
```

---

### Login (Đăng nhập)

**POST** `/auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "StrongP@ssw0rd"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
    "email": "user@example.com",
    "fullname": "Nguyen Van A",
    "phone": "0901234567"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Lưu ý:**
- `user.id` (user_id) là **UUID v7** format

**Error (401 Unauthorized):**
```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

**Lưu ý:** Lưu `access_token` và `refresh_token` (localStorage/sessionStorage) để dùng cho các request cần authentication.

---

### Refresh Token (Làm mới token)

**POST** `/auth/refresh`

**Request Body:**
```json
{
  "userId": "a3f1f8e6-5a6b-4b2d-9f1a-2c3d4e5f6a7b",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Khi nào dùng:** Khi `access_token` hết hạn (thường sau 15 phút), gọi API này với `refresh_token` để lấy tokens mới.

---

### Logout (Đăng xuất)

**POST** `/auth/logout`

**Request Body:**
```json
{
  "userId": "a3f1f8e6-5a6b-4b2d-9f1a-2c3d4e5f6a7b"
}
```

**Response (200 OK):**
```json
{
  "message": "Logout successful"
}
```

---

### Get Current User (Lấy thông tin user hiện tại)

**GET** `/auth/me`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "userId": "a3f1f8e6-5a6b-4b2d-9f1a-2c3d4e5f6a7b",
  "email": "user@example.com"
}
```

**Error (401 Unauthorized):** Token không hợp lệ hoặc hết hạn.

---

## Search Flights (Tìm kiếm chuyến bay)

### GET `/search/flights`

**Query Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `origin` | string | Yes | IATA code sân bay đi (3 ký tự) | `HAN` |
| `destination` | string | Yes | IATA code sân bay đến (3 ký tự) | `SGN` |
| `departDate` | string | Yes | Ngày đi (YYYY-MM-DD) | `2025-11-17` |
| `returnDate` | string | Optional* | Ngày về (YYYY-MM-DD) | `2025-11-24` |
| `tripType` | string | Yes | Loại chuyến: `one_way` hoặc `round_trip` | `one_way` |
| `adults` | number | Yes | Số người lớn (≥1) | `1` |
| `minors` | number | Yes | Số trẻ em (≥0) | `0` |

*Note: `returnDate` bắt buộc nếu `tripType=round_trip`

**Example Request:**
```
GET /search/flights?origin=HAN&destination=SGN&departDate=2025-11-17&tripType=one_way&adults=1&minors=0
```

**Response (200 OK) - One Way:**
```json
{
  "tripType": "one_way",
  "outbound": [
    {
      "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
      "flightNumber": "BB0100",
      "departureLocal": "2025-11-17T08:00:00.000Z",
      "arrivalLocal": "2025-11-17T10:10:00.000Z",
      "availableSeats": 180,
      "origin": {
        "iata": "HAN",
        "name": "Noi Bai International Airport",
        "city": "Hanoi"
      },
      "destination": {
        "iata": "SGN",
        "name": "Tan Son Nhat International Airport",
        "city": "Ho Chi Minh City"
      }
    }
  ],
  "totalPassengers": 1
}
```

**Response (200 OK) - Round Trip:**
```json
{
  "tripType": "round_trip",
  "outbound": [
    {
      "flightInstanceId": "...",
      "flightNumber": "BB0100",
      "departureLocal": "2025-11-17T08:00:00.000Z",
      "arrivalLocal": "2025-11-17T10:10:00.000Z",
      "availableSeats": 180,
      "origin": { "iata": "HAN", "name": "...", "city": "..." },
      "destination": { "iata": "SGN", "name": "...", "city": "..." }
    }
  ],
  "inbound": [
    {
      "flightInstanceId": "...",
      "flightNumber": "BB0101",
      "departureLocal": "2025-11-24T18:00:00.000Z",
      "arrivalLocal": "2025-11-24T20:10:00.000Z",
      "availableSeats": 180,
      "origin": { "iata": "SGN", "name": "...", "city": "..." },
      "destination": { "iata": "HAN", "name": "...", "city": "..." }
    }
  ],
  "totalPassengers": 1
}
```

**Error (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": ["returnDate is required when tripType is round_trip"],
  "error": "Bad Request"
}
```

**Error (404 Not Found):**
```json
{
  "statusCode": 404,
  "message": "Origin airport not found",
  "error": "Not Found"
}
```

---

### Get Fare Options (Lấy danh sách các loại vé/cabin)

**GET** `/search/fare-options`

Lấy danh sách các fare options (cabins) có sẵn cho một flight instance cụ thể theo cabin type (economy hoặc business).

**Query Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `flightInstanceId` | string (UUID v7) | Yes | ID của flight instance (UUID v7 - time-ordered) | `019a8f4a-bb0e-7402-a0c4-27647b89dc71` |
| `cabinType` | string | Yes | Loại cabin: `economy` hoặc `business` | `economy` |

**Example Request:**
```
GET /search/fare-options?flightInstanceId=019a8f4a-bb0e-7402-a0c4-27647b89dc71&cabinType=economy
```

**Lưu ý về UUID v7:**
- `flightInstanceId` phải là **UUID v7** (time-ordered UUID)
- UUID v7 có format: `xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx` (chữ số `7` ở vị trí version)
- UUID v7 có thể sắp xếp theo thời gian, phù hợp cho database indexing
- Tất cả IDs trong hệ thống (flightInstanceId, bookingId, userId...) đều sử dụng UUID v7

**Response (200 OK) - Economy:**
```json
[
  {
    "fareClassCode": "YSM",
    "name": "Economy Saver Max",
    "typeTicket": "Economy Saver Max",
    "price": 1448000,
    "availableSeats": 5,
    "desc": [
          {
            "text": "Hành lý xách tay: 7kg",
            "status": true
          },
          {
            "text": "Không bao gồm hành lý ký gửi",
            "status": false
          },
          {
            "text": "Không được hoàn/hủy",
            "status": false
          },
          {
            "text": "Thay đổi trước giờ khởi hành: 600.000 VND (*)",
            "status": true
          },
          {
            "text": "Không thay đổi sau giờ khởi hành (*)",
            "status": false
          },
          {
            "text": "Hệ số cộng điểm Bamboo Club: 0.25",
            "status": true
          },
          {
            "text": "Chọn ghế ngồi mất phí",
            "status": false
          },
          {
            "text": "Không áp dụng cho go-show",
            "status": false
          }
        ],
        "description": "Economy Saver Max",
        "changeRule": "Change before departure: 600,000 VND",
        "refundRule": "Non-refundable"
      },
      {
        "fareClassCode": "YS",
        "name": "Economy Smart",
        "typeTicket": "Economy Smart",
        "price": 1577000,
        "availableSeats": 10,
        "desc": [
          {
            "text": "Hành lý xách tay: 7kg",
            "status": true
          },
          {
            "text": "Không bao gồm hành lý ký gửi",
            "status": false
          },
          {
            "text": "Hoàn/hủy trước giờ khởi hành: 450.000 VND (*)",
            "status": true
          },
          {
            "text": "Hoàn/hủy sau giờ khởi hành: 600.000 VND (*)",
            "status": true
          },
          {
            "text": "Thay đổi trước giờ khởi hành: 450.000 VND (*)",
            "status": true
          },
          {
            "text": "Thay đổi sau giờ khởi hành: 600.000 VND (*)",
            "status": true
          },
          {
            "text": "Hệ số cộng điểm Bamboo Club: 0.5",
            "status": true
          },
          {
            "text": "Chọn ghế ngồi mất phí",
            "status": true
          },
          {
            "text": "Không áp dụng cho go-show",
            "status": false
          }
        ],
        "description": "Economy Smart",
        "changeRule": "Change before departure: 450,000 VND",
        "refundRule": "Refund before departure: 450,000 VND"
      },
      {
        "fareClassCode": "YF",
        "name": "Economy Flex",
        "typeTicket": "Economy Flex",
        "price": 3068000,
        "availableSeats": 3,
        "desc": [
          {
            "text": "Hành lý xách tay: 7kg",
            "status": true
          },
          {
            "text": "01 kiện hành lý ký gửi 20kg",
            "status": true
          },
          {
            "text": "Hoàn/hủy trước giờ khởi hành: 300.000 VND (*)",
            "status": true
          },
          {
            "text": "Hoàn/hủy sau giờ khởi hành: 300.000 VND (*)",
            "status": true
          },
          {
            "text": "Thay đổi miễn phí",
            "status": true
          },
          {
            "text": "Hệ số cộng điểm Bamboo Club: 1.00",
            "status": true
          },
          {
            "text": "Chọn ghế ngồi miễn phí",
            "status": true
          },
          {
            "text": "Đổi chuyến tại sân bay miễn phí",
            "status": true
          }
        ],
    "description": "Economy Flex",
    "changeRule": "Free changes",
    "refundRule": "Refund before departure: 300,000 VND"
  }
]
```

**Response (200 OK) - Business:**
```json
{
  "flightInstanceId": "a3f1f8e6-5a6b-4b2d-9f1a-2c3d4e5f6a7b",
  "cabinType": "business",
  "fareOptions": [
    {
      "fareClassCode": "JS",
      "name": "Business Smart",
      "price": 5022000,
      "availableSeats": 8,
      "description": "Business Smart",
      "changeRule": "Change before departure: 300,000 VND",
      "refundRule": "Refund before departure: 450,000 VND"
    },
    {
      "fareClassCode": "JF",
      "name": "Business Flex",
      "price": 7074000,
      "availableSeats": 5,
      "description": "Business Flex",
      "changeRule": "Free changes",
      "refundRule": "Refund before departure: 300,000 VND"
    }
  ]
}
```

**Error (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": ["flightInstanceId must be a valid UUID v7"],
  "error": "Bad Request"
}
```

Hoặc:
```json
{
  "statusCode": 400,
  "message": ["cabinType must be one of the following values: economy, business"],
  "error": "Bad Request"
}
```

**Error (404 Not Found):**
```json
{
  "statusCode": 404,
  "message": "Flight instance not found",
  "error": "Not Found"
}
```

**Lưu ý:**
- API này được gọi sau khi user đã chọn một flight từ kết quả search
- `flightInstanceId` lấy từ response của `/search/flights`
- `cabinType` là `economy` hoặc `business` (tương ứng với 2 nút trên UI)
- **Response format**: Trả về array trực tiếp của fare options `[{ fareClassCode, name, typeTicket, price, availableSeats, desc, ... }]`
- Response chỉ trả về các fare options có `availableSeats > 0`
- Fare options được sắp xếp theo price (tăng dần)
- Economy có 3 cabin types: Economy Saver Max, Economy Smart, Economy Flex
- Business có 2 cabin types: Business Smart, Business Flex
- Mỗi fare option có `desc` array chứa các mô tả chi tiết với `text` và `status` (true/false)
- `typeTicket` field chứa tên hiển thị của fare class (tương tự `name`)

---

## Reservations (Giữ chỗ tạm thời)

### Create Reservation (Tạo reservation)

**POST** `/reservations`

Tạo reservation để giữ chỗ tạm thời trước khi tạo booking. Hỗ trợ multi-segment cho round-trip bookings. Backend lưu tất cả segments vào Redis với TTL 15 phút.

**Authentication:** Required (JWT Bearer Token)

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "segments": [
    {
      "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
      "fareClassCode": "YS",
      "segmentType": "outbound"
    },
    {
      "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc72",
      "fareClassCode": "YS",
      "segmentType": "inbound"
    }
  ],
  "numberOfPassengers": 1,
  "currencyCode": "VND"
}
```

**Validation:**
- `segments`: Required, array of segments (minimum 1 segment)
  - `flightInstanceId`: Required, UUID v7 (từ `/search/flights` response)
  - `fareClassCode`: Required, string (từ `/search/fare-options` response)
  - `segmentType`: Required, enum: `'outbound'` or `'inbound'`
- `numberOfPassengers`: Required, integer >= 1
- `currencyCode`: Optional, default "VND"

**Round-Trip Validation:**
- One-way: 1 segment với `segmentType: 'outbound'` (hợp lệ)
- Round-trip: 2 segments với cả `outbound` và `inbound` (hợp lệ)
- Invalid: có `inbound` mà không có `outbound` (sẽ throw error)

**Response (201 Created):**
```json
{
  "reservationId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
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
    },
    {
      "segmentId": "019a8f4a-bb0e-7402-a0c4-27647b89dc74",
      "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc72",
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
  "expiresAt": "2025-01-20T10:30:00Z",
  "ttl": 900,
  "createdAt": "2025-01-20T10:15:00Z",
  "userId": "019a8f4a-bb0e-7402-a0c4-27647b89dc75"
}
```

**Error (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": "Not enough available seats. Available: 0, Required: 1",
  "error": "Bad Request"
}
```

**Lưu ý:**
- Reservation được lưu trong **Redis** (không phải database)
- Tự động expire sau 15 phút (900 seconds) - configurable qua `REDIS_RESERVATION_TTL`
- `reservationCode` là 6 ký tự alphanumeric (unique)
- Backend tự động validate availability và tính giá cho từng segment
- `totalAmount` = sum of (baseFare + taxAmount + feeAmount) * numberOfPassengers for all segments
- **Multi-segment support**: 1 reservation có thể chứa nhiều segments (outbound + inbound cho round-trip)
- **Backward compatibility**: Response vẫn có các fields cũ (`flightInstanceId`, `fareClassCode`, etc.) nhưng marked as deprecated

---

### Get Reservation (Lấy thông tin reservation)

**GET** `/reservations/:id`

Lấy thông tin reservation theo ID hoặc code (tự động detect).

**Authentication:** Required (JWT Bearer Token)

**Path Parameters:**
- `id`: Reservation ID (UUID v7) hoặc Reservation Code (6 alphanumeric characters)

**Example Requests:**
```
GET /reservations/019a8f4a-bb0e-7402-a0c4-27647b89dc71
GET /reservations/ABC123
```

**Response (200 OK):**
```json
{
  "reservationId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "reservationCode": "ABC123",
  "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "fareClassCode": "YS",
  "numberOfPassengers": 1,
  "baseFare": 1577000,
  "taxAmount": 0,
  "feeAmount": 0,
  "totalAmount": 1577000,
  "currencyCode": "VND",
  "status": "active",
  "expiresAt": "2025-01-20T10:30:00Z",
  "ttl": 850,
  "createdAt": "2025-01-20T10:15:00Z"
}
```

**Error (404 Not Found):**
```json
{
  "statusCode": 404,
  "message": "Reservation ABC123 not found or expired",
  "error": "Not Found"
}
```

**Error (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": "Reservation has expired",
  "error": "Bad Request"
}
```

**Lưu ý:**
- API tự động detect nếu input là UUID v7 (ID) hay 6 ký tự alphanumeric (code)
- `ttl` là thời gian còn lại tính bằng giây
- Nếu reservation đã expired, sẽ trả về error

---

### Get Reservation by Code (Lấy reservation theo code)

**GET** `/reservations/code/:code`

Lấy thông tin reservation theo reservation code (6 alphanumeric characters).

**Authentication:** Required (JWT Bearer Token)

**Path Parameters:**
- `code`: Reservation code (6 alphanumeric characters, e.g., "ABC123")

**Example Request:**
```
GET /reservations/code/ABC123
```

**Response:** Same as Get Reservation

---

### List Reservations (Danh sách reservations của user)

**GET** `/reservations`

Lấy danh sách tất cả active reservations của user hiện tại (từ JWT token).

**Authentication:** Required (JWT Bearer Token)

**Example Request:**
```
GET /reservations
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
[
  {
    "reservationId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
    "reservationCode": "ABC123",
    "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
    "fareClassCode": "YS",
    "numberOfPassengers": 1,
    "baseFare": 1577000,
    "taxAmount": 0,
    "feeAmount": 0,
    "totalAmount": 1577000,
    "currencyCode": "VND",
    "status": "active",
    "expiresAt": "2025-01-20T10:30:00Z",
    "ttl": 850,
    "createdAt": "2025-01-20T10:15:00Z"
  }
]
```

**Lưu ý:**
- Chỉ trả về reservations với status `active` và chưa expired
- TTL được tự động update khi list
- User chỉ có thể xem reservations của chính mình

---

### Cancel Reservation (Hủy reservation)

**POST** `/reservations/:id/cancel`

Hủy một reservation đang active, giải phóng chỗ đã giữ.

**Authentication:** Required (JWT Bearer Token)

**Path Parameters:**
- `id`: Reservation ID (UUID v7)

**Example Request:**
```
POST /reservations/019a8f4a-bb0e-7402-a0c4-27647b89dc71/cancel
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Reservation cancelled successfully"
}
```

**Error (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": "Cannot cancel reservation with status: expired",
  "error": "Bad Request"
}
```

**Lưu ý:**
- Chỉ có thể cancel reservation với status `active`
- Reservation đã expired hoặc cancelled không thể cancel lại
- User chỉ có thể cancel reservations của chính mình

---

### Extend Reservation (Gia hạn reservation)

**POST** `/reservations/:id/extend`

Gia hạn thời gian expiration của reservation thêm một số giây.

**Authentication:** Required (JWT Bearer Token)

**Path Parameters:**
- `id`: Reservation ID (UUID v7)

**Request Body:**
```json
{
  "additionalSeconds": 600
}
```

**Example Request:**
```
POST /reservations/019a8f4a-bb0e-7402-a0c4-27647b89dc71/extend
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "additionalSeconds": 600
}
```

**Response (200 OK):**
```json
{
  "reservationId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "reservationCode": "ABC123",
  "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "fareClassCode": "YS",
  "numberOfPassengers": 1,
  "baseFare": 1577000,
  "taxAmount": 0,
  "feeAmount": 0,
  "totalAmount": 1577000,
  "currencyCode": "VND",
  "status": "active",
  "expiresAt": "2025-01-20T10:40:00Z",
  "ttl": 1500,
  "createdAt": "2025-01-20T10:15:00Z"
}
```

**Error (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": "Cannot extend reservation with status: expired",
  "error": "Bad Request"
}
```

**Lưu ý:**
- Chỉ có thể extend reservation với status `active` và chưa expired
- `additionalSeconds` phải là số dương
- TTL và `expiresAt` sẽ được cập nhật trong Redis
- User chỉ có thể extend reservations của chính mình

---

## Bookings (Đặt vé)

### Create Booking (Tạo booking mới)

**POST** `/bookings?reservationId=xxx`

Tạo một booking mới từ reservation. **Reservation ID là REQUIRED**. Backend sẽ tự động lấy tất cả segments, pricing từ reservation để đảm bảo backend-managed state.

**Authentication:** Required (JWT Bearer Token)

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters (Required):**
- `reservationId` (string, **required**): Reservation ID (UUID v7) hoặc reservation code (6 alphanumeric). Backend sẽ tự động lấy tất cả segments, `fareClassCode`, và pricing từ reservation.

**Request Body:**
```json
POST /bookings?reservationId=019a8f4a-bb0e-7402-a0c4-27647b89dc71
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
  "contactEmail": "nguyenvana@example.com",
  "contactPhone": "0912345678",
  "channel": "web"
}
```

**Lưu ý quan trọng:**
- **Direct booking (không có reservationId) đã deprecated và không còn được hỗ trợ**
- Tất cả bookings phải được tạo từ reservation để đảm bảo backend-managed state
- Backend tự động lấy tất cả segments từ reservation (hỗ trợ multi-segment cho round-trip)
- Frontend chỉ cần gửi: `reservationId` + `passengers` + `contactInfo`

**Hoặc sử dụng passenger đã có:**
```json
{
  "currencyCode": "VND",
  "passengers": [
    {
      "passengerId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
      "passengerType": "ADT"
    }
  ],
  "segments": [...]
}
```

**Validation:**
- **`userId`**: Không cần truyền - sẽ được tự động extract từ JWT token
- `currencyCode`: Required, phải tồn tại trong database
- **`contactFullname`, `contactEmail`, `contactPhone`**: Optional - logic tự động:
  - Nếu có trong body → dùng (cho phép override)
  - Nếu không có và chỉ có 1 passenger thuộc về user → dùng `fullname` từ passenger, `email/phone` từ user
  - Nếu không → dùng thông tin từ user (booking contact person)
- `passengers`: Array, mỗi passenger có 2 options:
  - **Option 1**: Sử dụng passenger đã có → chỉ cần `passengerId` (UUID v7) và `passengerType`
  - **Option 2**: Tạo passenger mới → không cần `passengerId`, nhưng cần `fullname`, `dob` (YYYY-MM-DD), `gender`, `documentNumber` và `passengerType`
- `segments`: Array, mỗi segment cần `flightInstanceId`, `fareClassCode`, `baseFare`, `taxAmount`, `feeAmount`
- `flightSeatId`: Optional, có thể gán sau

**Lưu ý quan trọng:**
- **User vs Passenger**: 
  - **User**: Người đăng ký tài khoản và đặt vé (1 user có thể đặt nhiều vé)
  - **Passenger**: Người thực sự đi máy bay (1 user có thể có nhiều passengers: bản thân, người thân, bạn bè)
  - Một booking có thể có nhiều passengers (ví dụ: đặt vé cho cả gia đình)
- **Contact Info Logic**:
  - **Booking Contact Info**: Thông tin người đặt vé (để gửi email xác nhận, gọi điện về booking)
  - Nếu user đặt cho chính mình (1 passenger thuộc về user) → dùng tên passenger, email/phone user
  - Nếu user đặt cho người khác hoặc nhiều người → dùng thông tin user (booking contact person)
- **Passenger Creation Logic**:
  - Nếu có `passengerId` → sử dụng passenger đã có trong database
  - Nếu không có `passengerId` → tự động tạo passenger mới từ thông tin `fullname`, `dob`, `gender`, `documentNumber`
  - Passenger mới sẽ được link với user (từ JWT token) để có thể tái sử dụng sau này
  - Nếu passenger với cùng `documentNumber` đã tồn tại cho user → sử dụng passenger đã có (tránh duplicate)

**Response (201 Created):**
```json
{
  "bookingId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "pnrCode": "ABC123",
  "totalAmount": 1577000,
  "currencyCode": "VND",
  "status": "pending"
}
```

**Error (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": "Currency VND not found",
  "error": "Bad Request"
}
```

**Error (404 Not Found):**
```json
{
  "statusCode": 404,
  "message": "Flight instance 019a8f4a-bb0e-7402-a0c4-27647b89dc71 not found",
  "error": "Not Found"
}
```

**Lưu ý:**
- **Recommended Flow**: Sử dụng `?reservationId=xxx` để tạo booking từ reservation (backend-managed state)
  - Backend tự động lấy `flightInstanceId`, `fareClassCode`, và pricing từ reservation
  - Không cần gửi lại `segments` trong request body
  - Reservation sẽ tự động được cancel sau khi tạo booking thành công
- **Legacy Flow**: Tạo booking trực tiếp (không dùng reservation)
  - Cần gửi đầy đủ `segments` với `flightInstanceId`, `fareClassCode`, pricing
- PNR code được tự động generate (6 ký tự alphanumeric, unique)
- Total amount được tính từ tổng của tất cả segments (baseFare + taxAmount + feeAmount)
- Booking được tạo với status `pending`
- Transaction-safe: Tất cả operations được thực hiện trong một transaction
- **Validation khi dùng reservationId**:
  - Reservation phải còn active và chưa expired
  - Reservation phải thuộc về user (từ JWT)
  - Số lượng passengers phải khớp với reservation

---

### Get Booking Fare Details (Lấy thông tin chi tiết fare đã chọn)

**GET** `/bookings/:id/fare-details`

Lấy thông tin chi tiết về fare class đã chọn trong booking, bao gồm descriptions và pricing.

**Path Parameters:**
- `id`: Booking ID (UUID v7)

**Example Request:**
```
GET /bookings/019a8f4a-bb0e-7402-a0c4-27647b89dc71/fare-details
```

**Response (200 OK):**
```json
{
  "bookingId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "pnrCode": "ABC123",
  "fareClassName": "Economy Smart",
  "descriptions": [
    {
      "text": "Hành lý xách tay: 7kg",
      "status": true
    },
    {
      "text": "Không bao gồm hành lý ký gửi",
      "status": false
    },
    {
      "text": "Hoàn/hủy trước giờ khởi hành: 450.000 VND (*)",
      "status": true
    },
    {
      "text": "Hoàn/hủy sau giờ khởi hành: 600.000 VND (*)",
      "status": true
    },
    {
      "text": "Thay đổi trước giờ khởi hành: 450.000 VND (*)",
      "status": true
    },
    {
      "text": "Thay đổi sau giờ khởi hành: 600.000 VND (*)",
      "status": true
    },
    {
      "text": "Hệ số cộng điểm Bamboo Club: 0.5",
      "status": true
    },
    {
      "text": "Chọn ghế ngồi mất phí",
      "status": true
    },
    {
      "text": "Không áp dụng cho go-show",
      "status": false
    }
  ],
  "priceOneWay": 1577000,
  "totalPassengers": 1,
  "totalPrice": 1577000
}
```

**Error (404 Not Found):**
```json
{
  "statusCode": 404,
  "message": "Booking 019a8f4a-bb0e-7402-a0c4-27647b89dc71 not found",
  "error": "Not Found"
}
```

**Lưu ý:**
- API này được gọi sau khi user đã chọn fare class và tạo booking
- `descriptions` chứa danh sách các điều kiện/quyền lợi của fare class
- `priceOneWay` là tổng giá của tất cả segments trong booking
- `totalPassengers` là số lượng passengers trong booking

---

### Update Booking Passengers (Cập nhật số lượng người)

**PATCH** `/bookings/:id/passengers`

Cập nhật số lượng adult và minor passengers cho một booking.

**Path Parameters:**
- `id`: Booking ID (UUID v7)

**Request Body:**
```json
{
  "adults": 2,
  "minors": 1
}
```

**Validation:**
- `adults`: Required, integer ≥ 1
- `minors`: Required, integer ≥ 0

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Passenger count updated from 1 to 3",
  "totalPassengers": 3
}
```

**Error (404 Not Found):**
```json
{
  "statusCode": 404,
  "message": "Booking 019a8f4a-bb0e-7402-a0c4-27647b89dc71 not found",
  "error": "Not Found"
}
```

**Lưu ý:**
- API này cho phép thay đổi số lượng người sau khi đã tạo booking
- Có thể cần recalculate total amount dựa trên số lượng mới (tính năng này có thể được mở rộng)

---

### Get Booking Payment Info (Lấy thông tin thanh toán)

**GET** `/bookings/:id/payment-info`

Lấy thông tin thanh toán cho một booking, bao gồm total amount, currency, và contact details.

**Path Parameters:**
- `id`: Booking ID (UUID v7)

**Example Request:**
```
GET /bookings/019a8f4a-bb0e-7402-a0c4-27647b89dc71/payment-info
```

**Response (200 OK):**
```json
{
  "bookingId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "pnrCode": "ABC123",
  "totalAmount": 1577000,
  "currencyCode": "VND",
  "contactFullname": "Nguyen Van A",
  "contactEmail": "nguyenvana@example.com",
  "contactPhone": "0912345678",
  "status": "pending"
}
```

**Error (404 Not Found):**
```json
{
  "statusCode": 404,
  "message": "Booking 019a8f4a-bb0e-7402-a0c4-27647b89dc71 not found",
  "error": "Not Found"
}
```

**Lưu ý:**
- API này được gọi khi user chuyển đến trang thanh toán
- Thông tin này được dùng để hiển thị trên payment page
- `status` có thể là: `pending`, `confirmed`, `cancelled`, `completed`

---

## Services (Dịch vụ chuyến bay)

### Get Flight Deals (Lấy danh sách deals chuyến bay)

**GET** `/services/deals`

Lấy danh sách các flight deals (ưu đãi chuyến bay) với thông tin route, ngày bay, và giá. API này được dùng để hiển thị các deals trên trang chủ hoặc trang deals.

**Query Parameters:** Không có (API này không cần parameters)

**Example Request:**
```
GET /services/deals
```

**Response (200 OK):**
```json
{
  "deals": [
    {
      "image": "/images/routes/019a8f4a-bb0e-7402-a0c4-27647b89dc71.jpg",
      "title": "Tp. Hồ Chí Minh (SGN) đến Hà Nội (HAN)",
      "link": "/service/019a8f4a-bb0e-7402-a0c4-27647b89dc71",
      "startDate": "02/03/2026",
      "endDate": "",
      "tripType": "one_way",
      "service": "Dịch vụ bay thẳng",
      "price": "962,000 VND"
    },
    {
      "image": "/images/routes/019a8f4a-bb0e-7402-a0c4-27647b89dc71.jpg",
      "title": "Tp. Hồ Chí Minh (SGN) đến Hà Nội (HAN)",
      "link": "/service/019a8f4a-bb0e-7402-a0c4-27647b89dc71",
      "startDate": "02/03/2026",
      "endDate": "09/03/2026",
      "tripType": "round_trip",
      "service": "Dịch vụ bay khứ hồi",
      "price": "1,924,000 VND"
    },
    {
      "image": "/images/routes/019b1f5b-cc1f-8513-b1d5-38758c90ed82.jpg",
      "title": "Tp. Hồ Chí Minh (SGN) đến Quy Nhơn (UIH)",
      "link": "/service/019b1f5b-cc1f-8513-b1d5-38758c90ed82",
      "startDate": "25/12/2026",
      "endDate": "",
      "tripType": "one_way",
      "service": "Dịch vụ bay thẳng",
      "price": "692,000 VND"
    }
  ]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `deals` | array | Danh sách các flight deals (bao gồm cả one-way và round-trip) |
| `deals[].image` | string | Đường dẫn đến hình ảnh deal, format: `/images/routes/{route_id}.jpg` (route_id là UUID v7 - 36 ký tự) |
| `deals[].title` | string | Mô tả route bằng tiếng Việt (e.g., "Tp. Hồ Chí Minh (SGN) đến Hà Nội (HAN)") |
| `deals[].link` | string | Link đến trang chi tiết service, format: `/service/{route_id}` (route_id là UUID v7 - 36 ký tự) |
| `deals[].startDate` | string | Ngày đi theo format DD/MM/YYYY (e.g., "02/03/2026") |
| `deals[].endDate` | string | Ngày về theo format DD/MM/YYYY (rỗng cho one-way flights, có giá trị cho round-trip) |
| `deals[].tripType` | string | Loại chuyến bay: `"one_way"` hoặc `"round_trip"` |
| `deals[].service` | string | Loại dịch vụ: "Dịch vụ bay thẳng" (one-way) hoặc "Dịch vụ bay khứ hồi" (round-trip) |
| `deals[].price` | string | Giá đã format với dấu phẩy và "VND". Với round-trip, giá là tổng của cả 2 chuyến (e.g., "1,924,000 VND") |

**Lưu ý:**
- API trả về tất cả routes nội địa có flights available trong 30 ngày tới
- Mỗi route có thể có cả **one-way** và **round-trip** deals (nếu có return route và return flights available)
- Deals được sắp xếp theo giá tăng dần (từ rẻ nhất đến đắt nhất)
- Round-trip deals chỉ được tạo nếu:
  - Có return route (reverse route) tồn tại
  - Có return flights available trong vòng 7-37 ngày sau ngày đi
  - Có booking data để tính giá cho return route
- Giá round-trip = giá đi + giá về (tổng của 2 chuyến)
- `image` và `link` được lấy từ database (bảng Routes: `image_url`, `service_link`), format: 
  - `image` = `/images/routes/{route_id}.jpg` (route_id là UUID v7 - 36 ký tự, length = 55)
  - `link` = `/service/{route_id}` (route_id là UUID v7 - 36 ký tự, length = 45)

**Error (500 Internal Server Error):**
```json
{
  "statusCode": 500,
  "message": "Services microservice is not running. Please start it with: npm run start:services",
  "error": "Internal Server Error"
}
```

**Lưu ý về Pricing:**
- Giá được tính từ **historical pricing** (lấy từ BookingSegments của các booking đã có)
- Tính **giá trung bình** (average price) từ tất cả booking segments của route
- Nếu không có booking data cho route, route đó sẽ **bị bỏ qua** (không hiển thị trong deals)
- Giá bao gồm: base_fare + tax_amount + fee_amount
- Giá được format theo chuẩn Việt Nam với dấu phẩy ngăn cách hàng nghìn

---

## Common IATA Codes (Sân bay nội địa Việt Nam)

- **HAN**: Noi Bai International Airport (Hà Nội)
- **SGN**: Tan Son Nhat International Airport (TP. Hồ Chí Minh)
- **DAD**: Da Nang International Airport (Đà Nẵng)

---

## Error Handling

### Status Codes

- **200 OK**: Request thành công
- **201 Created**: Tạo mới thành công (register)
- **400 Bad Request**: Validation error hoặc thiếu tham số
- **401 Unauthorized**: Chưa đăng nhập hoặc token không hợp lệ
- **404 Not Found**: Không tìm thấy resource (airport, route...)
- **500 Internal Server Error**: Lỗi server

### Error Response Format

```json
{
  "statusCode": 400,
  "message": ["error message 1", "error message 2"],
  "error": "Bad Request"
}
```

**Lưu ý:** `message` có thể là `string` hoặc `string[]` (mảng các lỗi validation).

---

## Authentication Flow

1. **Register/Login** → Lấy `access_token` và `refresh_token`
2. **Lưu tokens** vào localStorage/sessionStorage
3. **Gửi `access_token`** trong header cho các request cần auth:
   ```
   Authorization: Bearer <access_token>
   ```
4. **Khi `access_token` hết hạn** (401 error):
   - Gọi `/auth/refresh` với `refresh_token`
   - Lấy tokens mới và update
   - Retry request ban đầu
5. **Logout** → Xóa tokens khỏi storage

---

## Example Usage

### JavaScript/TypeScript (Fetch API)

```javascript
// Login
const loginResponse = await fetch('http://localhost:3000/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'StrongP@ssw0rd'
  })
});
const { access_token, refresh_token } = await loginResponse.json();

// Search Flights
const searchResponse = await fetch(
  'http://localhost:3000/search/flights?origin=HAN&destination=SGN&departDate=2025-11-17&tripType=one_way&adults=1&minors=0'
);
const flights = await searchResponse.json();

// Authenticated Request
const meResponse = await fetch('http://localhost:3000/auth/me', {
  headers: {
    'Authorization': `Bearer ${access_token}`
  }
});
const userInfo = await meResponse.json();
```

### Axios

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000'
});

// Login
const { data } = await api.post('/auth/login', {
  email: 'user@example.com',
  password: 'StrongP@ssw0rd'
});

// Set token for subsequent requests
api.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;

// Search Flights
const { data: flights } = await api.get('/search/flights', {
  params: {
    origin: 'HAN',
    destination: 'SGN',
    departDate: '2025-11-17',
    tripType: 'one_way',
    adults: 1,
    minors: 0
  }
});

// Get Fare Options for a flight instance
const { data: fareOptions } = await api.get('/search/fare-options', {
  params: {
    flightInstanceId: flights.outbound[0].flightInstanceId,
    cabinType: 'economy'
  }
});
```

---

## Notes

1. **Swagger UI**: Xem và test API trực tiếp tại `http://localhost:3000/api-docs`
2. **Round Trip**: Khi `tripType=round_trip`, bắt buộc phải có `returnDate`
3. **Dates**: Format date là `YYYY-MM-DD` (ví dụ: `2025-11-17`) cho search API, nhưng `DD/MM/YYYY` cho deals API
4. **IATA Codes**: Phải đúng 3 ký tự, uppercase (HAN, SGN, DAD...)
5. **Token Expiry**: `access_token` hết hạn sau 15 phút, `refresh_token` sau 7 ngày
6. **Fare Options Flow**: 
   - Bước 1: Gọi `/search/flights` để lấy danh sách flights
   - Bước 2: User chọn một flight → lấy `flightInstanceId` (UUID v7)
   - Bước 3: Gọi `/search/fare-options` với `flightInstanceId` và `cabinType` (economy/business)
   - Bước 4: Response trả về array trực tiếp `[{ fareClassCode, name, typeTicket, price, desc, ... }]`
   - Bước 5: Hiển thị dropdown với các fare options (cabins) tương ứng
7. **UUID v7**: Tất cả IDs trong hệ thống sử dụng UUID v7 (time-ordered). Format: `xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx`. UUID v7 có thể sắp xếp theo thời gian, tốt cho database indexing.
8. **Services Microservice**: API `/services/deals` cần Services Microservice chạy (port 4002). Chạy bằng: `npm run start:services` hoặc `npm run start:services:dev`
9. **Booking Microservice**: Tất cả booking APIs cần Booking Microservice chạy (port 4004). Chạy bằng: `npm run start:booking` hoặc `npm run start:booking:dev`
10. **Pricing Strategy**: 
    - Giá trong deals được tính từ historical pricing (BookingSegments) nếu có
    - Nếu chưa có booking, dùng fallback prices (giá mặc định)
    - Giá được format theo chuẩn Việt Nam: "962,000 VND"
11. **Booking Flow (Recommended - Backend-managed State)**:
    - Bước 1: Search flights → `GET /search/flights`
    - Bước 2: Chọn flight → Get fare options → `GET /search/fare-options`
    - Bước 3: Chọn fare class → Create reservation → `POST /reservations` (lưu `reservationId`)
    - Bước 4: Điền thông tin passenger → Create booking from reservation → `POST /bookings?reservationId=xxx`
    - Bước 5: Xem fare details → `GET /bookings/:id/fare-details`
    - Bước 6: Update passengers (nếu cần) → `PATCH /bookings/:id/passengers`
    - Bước 7: Get payment info → `GET /bookings/:id/payment-info`
    - Bước 8: Thanh toán (API này sẽ được implement sau)
    
    **Lưu ý**: Reservation sẽ tự động được cancel sau khi tạo booking thành công.

