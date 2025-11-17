# API Documentation - Flight Booking Backend

## Base URL

```
http://localhost:3000
```

**Swagger UI**: `http://localhost:3000/api-docs` (Interactive API documentation)

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
    "id": "a3f1f8e6-5a6b-4b2d-9f1a-2c3d4e5f6a7b",
    "fullname": "Nguyen Van A",
    "email": "user@example.com",
    "phone": "0901234567",
    "created_at": "2025-11-17T10:00:00.000Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

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
    "id": "a3f1f8e6-5a6b-4b2d-9f1a-2c3d4e5f6a7b",
    "email": "user@example.com",
    "fullname": "Nguyen Van A",
    "phone": "0901234567"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

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
{
  "flightInstanceId": "a3f1f8e6-5a6b-4b2d-9f1a-2c3d4e5f6a7b",
  "cabinType": "economy",
  "fareOptions": [
    {
      "fareClassCode": "YSM",
      "name": "Economy Saver Max",
      "price": 1448000,
      "availableSeats": 5,
      "description": "Economy Saver Max",
      "changeRule": "Change before departure: 600,000 VND",
      "refundRule": "Non-refundable"
    },
    {
      "fareClassCode": "YS",
      "name": "Economy Smart",
      "price": 1577000,
      "availableSeats": 10,
      "description": "Economy Smart",
      "changeRule": "Change before departure: 450,000 VND",
      "refundRule": "Refund before departure: 450,000 VND"
    },
    {
      "fareClassCode": "YF",
      "name": "Economy Flex",
      "price": 3068000,
      "availableSeats": 3,
      "description": "Economy Flex",
      "changeRule": "Free changes",
      "refundRule": "Refund before departure: 300,000 VND"
    }
  ]
}
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
- Response chỉ trả về các fare options có `availableSeats > 0`
- Fare options được sắp xếp theo price (tăng dần)
- Economy có 3 cabin types: Economy Saver Max, Economy Smart, Economy Flex
- Business có 2 cabin types: Business Smart, Business Flex

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
      "service": "Dịch vụ bay thẳng",
      "price": "962,000 VND"
    },
    {
      "image": "/images/routes/019b1f5b-cc1f-8513-b1d5-38758c90ed82.jpg",
      "title": "Tp. Hồ Chí Minh (SGN) đến Quy Nhơn (UIH)",
      "link": "/service/019b1f5b-cc1f-8513-b1d5-38758c90ed82",
      "startDate": "25/12/2026",
      "endDate": "",
      "service": "Dịch vụ bay thẳng",
      "price": "962,000 VND"
    },
    {
      "image": "/images/routes/019c2g6c-dd2g-9624-c2e6-49869d01fe93.jpg",
      "title": "Hà Nội (HAN) đến Tp. Hồ Chí Minh (SGN)",
      "link": "/service/019c2g6c-dd2g-9624-c2e6-49869d01fe93",
      "startDate": "10/02/2026",
      "endDate": "",
      "service": "Dịch vụ bay thẳng",
      "price": "692,000 VND"
    }
  ]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `deals` | array | Danh sách các flight deals |
| `deals[].image` | string | Đường dẫn đến hình ảnh deal, format: `/images/routes/{route_id}.jpg` (route_id là UUID v7 - 36 ký tự) |
| `deals[].title` | string | Mô tả route bằng tiếng Việt (e.g., "Tp. Hồ Chí Minh (SGN) đến Hà Nội (HAN)") |
| `deals[].link` | string | Link đến trang chi tiết service, format: `/service/{route_id}` (route_id là UUID v7 - 36 ký tự) |
| `deals[].startDate` | string | Ngày đi theo format DD/MM/YYYY (e.g., "02/03/2026") |
| `deals[].endDate` | string | Ngày về (rỗng cho one-way flights) |
| `deals[].service` | string | Loại dịch vụ (e.g., "Dịch vụ bay thẳng") |
| `deals[].price` | string | Giá đã format với dấu phẩy và "VND" (e.g., "962,000 VND") |

**Lưu ý:**
- API trả về tất cả routes nội địa có flights available trong 30 ngày tới
- Deals được sắp xếp theo giá tăng dần (từ rẻ nhất đến đắt nhất)
- `endDate` luôn rỗng vì deals chỉ hiển thị one-way flights
- `service` luôn là "Dịch vụ bay thẳng" (direct flight service)
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
   - Bước 4: Hiển thị dropdown với các fare options (cabins) tương ứng
7. **UUID v7**: Tất cả IDs trong hệ thống sử dụng UUID v7 (time-ordered). Format: `xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx`. UUID v7 có thể sắp xếp theo thời gian, tốt cho database indexing.
8. **Services Microservice**: API `/services/deals` cần Services Microservice chạy (port 4002). Chạy bằng: `npm run start:services` hoặc `npm run start:services:dev`
9. **Pricing Strategy**: 
   - Giá trong deals được tính từ historical pricing (BookingSegments) nếu có
   - Nếu chưa có booking, dùng fallback prices (giá mặc định)
   - Giá được format theo chuẩn Việt Nam: "962,000 VND"

