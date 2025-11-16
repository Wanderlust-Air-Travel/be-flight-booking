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
      "flightInstanceId": "a3f1f8e6-5a6b-4b2d-9f1a-2c3d4e5f6a7b",
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
```

---

## Notes

1. **Swagger UI**: Xem và test API trực tiếp tại `http://localhost:3000/api-docs`
2. **Round Trip**: Khi `tripType=round_trip`, bắt buộc phải có `returnDate`
3. **Dates**: Format date là `YYYY-MM-DD` (ví dụ: `2025-11-17`)
4. **IATA Codes**: Phải đúng 3 ký tự, uppercase (HAN, SGN, DAD...)
5. **Token Expiry**: `access_token` hết hạn sau 15 phút, `refresh_token` sau 7 ngày

