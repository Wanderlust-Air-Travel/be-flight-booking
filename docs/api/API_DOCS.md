# API Documentation - Flight Booking Backend

**Lưu ý:** Hệ thống chỉ hỗ trợ bay nội địa Việt Nam.

## Base URL

```
http://localhost:3000
```

**Swagger UI**: `http://localhost:3000/api-docs`

**RabbitMQ Management UI**: `http://localhost:15672` (admin/admin123)

## Lưu ý quan trọng

### Xác thực
- **Required Authentication**: Một số API bắt buộc đăng nhập (ví dụ: `GET /api/v1/bookings/my-tickets`, `GET /api/v1/bookings/my-journey`, `PATCH /api/v1/bookings/:id/cancel`, `PATCH /api/v1/bookings/tickets/:ticketId/cancel`, `GET /api/v1/bookings/tickets/:ticketId/info`, `POST /api/v1/booking-state/cabin`, `POST /api/v1/booking-state/seat`)
- **Optional Authentication**: Một số API hỗ trợ optional authentication (có thể gọi với hoặc không có token):
  - `POST /api/v1/reservations` - Guest bookings được hỗ trợ
  - `POST /api/v1/bookings` - Guest bookings được hỗ trợ (contact info bắt buộc cho guest)
  - `GET /api/v1/search/fare-options` - Tự động lấy `flightInstanceId` và `cabinType` từ booking state nếu user đã đăng nhập
  - `GET /api/v1/search/seats` - Tự động lấy `cabinType` từ booking state nếu user đã đăng nhập
  - `GET /api/v1/bookings/:id/fare-details` - Public endpoint
  - `GET /api/v1/bookings/:id/payment-info` - Public endpoint
- **Guest Bookings**: Người dùng chưa đăng nhập có thể đặt chuyến bay, nhưng phải cung cấp đầy đủ contact information
- Sau khi đăng nhập, gửi token trong header: `Authorization: Bearer <access_token>`
- Token có hiệu lực 15 phút, dùng `refresh_token` để lấy token mới
- Nếu không có token hoặc không có booking state, phải truyền đầy đủ query parameters

### Định dạng
- ID: Tất cả ID là mã UUID dạng `xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx`
- Ngày: Format `YYYY-MM-DD` (ví dụ: `2025-11-17`)

### Luồng đặt vé

**Authenticated Flow (Có đăng nhập):**
1. Tìm kiếm chuyến bay
2. Chọn loại vé (cabin) → Lưu cabin vào Redis (`POST /api/v1/booking-state/cabin`)
   - **Validation**: Fare class code phải match với cabin type (Economy: 'Y*', Business: 'J*')
3. **Chọn ghế ngồi (BẮT BUỘC)** → Lưu seat vào Redis (`POST /api/v1/booking-state/seat`)
   - **Auto-fetch**: `GET /api/v1/search/seats` có thể tự động lấy `cabinType` từ booking state nếu user đã đăng nhập
4. **Verify state (Optional - Recommended)** → Kiểm tra state trước khi tạo reservation (`GET /api/v1/booking-state/:flightInstanceId`)
5. Giữ chỗ 15 phút (reservation) - Backend tự động lấy cabin + seat từ Redis, lưu reservation vào Redis, tự động clear booking state sau khi thành công
6. Điền thông tin hành khách (contact info optional - sẽ dùng user info nếu không có)
7. Tạo booking (có thể dùng `passengerId` để tái sử dụng passenger đã lưu)
8. Thanh toán

**Guest Flow (Không cần đăng nhập):**
1. Tìm kiếm chuyến bay
2. Chọn loại vé (cabin) → Lưu cabin vào Redis (`POST /api/v1/booking-state/cabin`) - **Cần đăng nhập**
3. **Chọn ghế ngồi (BẮT BUỘC)** → Lưu seat vào Redis (`POST /api/v1/booking-state/seat`) - **Cần đăng nhập**
4. Giữ chỗ 15 phút (reservation) - **Có thể gọi không cần token** (reservation sẽ không có userId)
5. Điền thông tin hành khách và contact info (**BẮT BUỘC** cho guest bookings)
6. Tạo booking (**Không cần token**, nhưng contact info là bắt buộc)
7. Thanh toán

**Lưu ý:** Guest bookings hiện tại vẫn cần đăng nhập để lưu booking state (cabin/seat). Trong tương lai có thể mở rộng để hỗ trợ guest booking state.

**Lưu ý:** 
- Backend tự quản lý state trong Redis. Frontend chỉ cần fetch và gọi API.
- **Stateless Frontend**: Frontend không cần lưu `flightInstanceId` vào session - có thể lấy từ `GET /api/v1/booking-state`
- State tự động expire sau 30 phút (TTL)
- State tự động được clear sau khi tạo reservation thành công
- Optional: `DELETE /api/v1/booking-state/:flightInstanceId` để xóa state và bắt đầu lại
- Optional: `GET /api/v1/booking-state` để lấy tất cả booking states (bao gồm `flightInstanceId`)

---

## Authentication (Xác thực)

### Đăng ký
**POST** `/api/v1/auth/register`

```json
{
  "fullname": "Nguyen Van A",
  "email": "user@example.com",
  "password": "StrongP@ssw0rd",
  "phone": "0901234567"
}
```

**Trả về:** Thông tin user, `access_token`, `refresh_token`

---

### Đăng nhập
**POST** `/api/v1/auth/login`

```json
{
  "email": "user@example.com",
  "password": "StrongP@ssw0rd"
}
```

**Trả về:** Thông tin user, `access_token`, `refresh_token`

---

### Làm mới token
**POST** `/api/v1/auth/refresh`

Khi `access_token` hết hạn, dùng `refresh_token` để lấy token mới.

---

### Gửi OTP thanh toán
**POST** `/api/v1/auth/otp/payment/send`

**Cần đăng nhập:** Không (nhưng `userId` phải hợp lệ)

```json
{
  "userId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71"
}
```

**Validation:**
- `userId`: Bắt buộc, phải là UUID v7 hợp lệ (format: `xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx`)

**Trả về:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "expiresIn": 900
}
```

**Lưu ý:**
- OTP được gửi đến email của user
- Hết hạn sau 15 phút (900 giây)
- OTP được lưu trong Redis với TTL 15 phút

**Error Responses:**
- **400 Bad Request**: `userId` không phải UUID v7 hợp lệ hoặc thiếu tham số
- **404 Not Found**: User không tồn tại
- **503 Service Unavailable**: Email microservice không khả dụng (connection closed/refused/timeout)

---

### Xác thực OTP thanh toán
**POST** `/api/v1/auth/otp/payment/verify`

**Cần đăng nhập:** Không (nhưng `userId` phải hợp lệ)

```json
{
  "userId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "otp": "123456"
}
```

**Validation:**
- `userId`: Bắt buộc, phải là UUID v7 hợp lệ (format: `xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx`)
- `otp`: Bắt buộc, phải là chuỗi 6 ký tự

**Trả về:**
```json
{
  "success": true,
  "message": "OTP verified successfully"
}
```

**Error Responses:**
- **400 Bad Request**: `userId` không phải UUID v7 hợp lệ, `otp` không đúng format, hoặc thiếu tham số
- **401 Unauthorized**: OTP không hợp lệ hoặc đã hết hạn
- **404 Not Found**: User không tồn tại

---

### Gửi OTP đặt lại mật khẩu
**POST** `/api/v1/auth/otp/password-reset/send`

```json
{
  "email": "user@example.com"
}
```

- OTP được gửi đến email (nếu email tồn tại)
- Hết hạn sau 10 phút
- Luôn trả về thành công (bảo mật)

---

### Xác thực OTP và đặt lại mật khẩu
**POST** `/api/v1/auth/otp/password-reset/verify`

```json
{
  "email": "user@example.com",
  "otp": "123456",
  "newPassword": "NewStrongP@ssw0rd"
}
```

---

### Gửi OTP hủy vé
**POST** `/api/v1/auth/otp/cancellation/send`

**Cần đăng nhập:** Có

**Mô tả:** Gửi OTP đến email của user để xác thực việc hủy booking/ticket đã thanh toán.

```json
{
  "userId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "bookingId": "019a8f4a-bb0e-7402-a0c4-27647b89dc72"
}
```

**Validation:**
- `userId`: Bắt buộc, phải là UUID v7 hợp lệ
- `bookingId`: Bắt buộc, phải là UUID v7 hợp lệ

**Trả về:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "expiresIn": 300
}
```

- OTP được gửi đến email của user
- Hết hạn sau 5 phút (300 giây)
- OTP được lưu trong Redis với key: `otp:cancellation:{userId}:{bookingId}`

**Lỗi có thể xảy ra:**
- `400 Bad Request`: "Invalid UUID format" - UUID không hợp lệ
- `404 Not Found`: "User not found" - User không tồn tại
- `503 Service Unavailable`: "Email service is not available" - Email service không available

---

### Xác thực OTP hủy vé
**POST** `/api/v1/auth/otp/cancellation/verify`

**Cần đăng nhập:** Có

**Mô tả:** Xác thực OTP để cho phép hủy booking/ticket đã thanh toán. Sau khi verify thành công, một verification token được lưu trong Redis (10 phút) để cho phép cancel request tiếp theo.

```json
{
  "userId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "bookingId": "019a8f4a-bb0e-7402-a0c4-27647b89dc72",
  "otp": "123456"
}
```

**Validation:**
- `userId`: Bắt buộc, phải là UUID v7 hợp lệ
- `bookingId`: Bắt buộc, phải là UUID v7 hợp lệ
- `otp`: Bắt buộc, phải là 6 ký tự số

**Trả về:**
```json
{
  "success": true,
  "message": "OTP verified successfully"
}
```

**Flow:**
1. Verify OTP từ Redis
2. Nếu hợp lệ, tạo verification token trong Redis (TTL: 10 phút)
3. Xóa OTP gốc (one-time use)
4. Cancel request tiếp theo sẽ check verification token thay vì OTP

**Lỗi có thể xảy ra:**
- `400 Bad Request`: "Invalid UUID format" hoặc "OTP must be exactly 6 digits" - Validation error
- `401 Unauthorized`: "Invalid or expired OTP" - OTP không hợp lệ hoặc đã hết hạn
- `404 Not Found`: "User not found" - User không tồn tại

---

## Search Flights (Tìm kiếm chuyến bay)

### Lấy danh sách airports
**GET** `/api/v1/search/airports`

**Authentication:** Không cần (Public endpoint)

**Mô tả:** Lấy danh sách tất cả airports từ database, sorted by city name. Dùng cho frontend dropdown selection trong flight search form.

**Trả về:**
```json
{
  "airports": [
    {
      "iata": "HAN",
      "name": "Noi Bai International Airport",
      "city": "Hanoi",
      "value": "ha-noi"
    },
    {
      "iata": "SGN",
      "name": "Tan Son Nhat International Airport",
      "city": "Ho Chi Minh City",
      "value": "ho-chi-minh-city"
    }
  ]
}
```

**Response Fields:**
- `iata`: IATA code của airport (3 ký tự, ví dụ: `HAN`, `SGN`)
- `name`: Tên đầy đủ của airport
- `city`: Tên thành phố
- `value`: Slug value cho frontend (city name in lowercase with hyphens)

**Lưu ý:**
- Tất cả airports đều là sân bay nội địa Việt Nam
- Response được sort theo city name (ASC)
- Frontend nên cache response để giảm số lượng API calls

**Lỗi có thể xảy ra:**
- `500 Internal Server Error`: Database error hoặc microservice unavailable

---

### Tìm kiếm chuyến bay
**GET** `/api/v1/search/flights`

**Tham số:**
- `origin` (bắt buộc): Mã sân bay đi (3 ký tự, ví dụ: `HAN`)
- `destination` (bắt buộc): Mã sân bay đến (3 ký tự, ví dụ: `SGN`)
- `departDate` (bắt buộc): Ngày đi (`YYYY-MM-DD`)
- `returnDate` (tùy chọn): Ngày về (`YYYY-MM-DD`)
  - **Logic tự động**: Nếu **không truyền** `returnDate` (hoặc để trống) → API tự động set `tripType = one_way`
  - Nếu **có truyền** `returnDate` → API tự động set `tripType = round_trip`
- `tripType` (tùy chọn): `one_way` hoặc `round_trip`
  - Nếu không truyền: Tự động dựa vào `returnDate` (có `returnDate` → `round_trip`, không có → `one_way`)
  - Nếu truyền: Sẽ override logic tự động
- `adults` (bắt buộc): Số người lớn (≥1)
- `minors` (bắt buộc): Số trẻ em (≥0)

**Ví dụ:**
```
GET /api/v1/search/flights?origin=HAN&destination=SGN&departDate=2025-11-17&adults=1&minors=0
GET /api/v1/search/flights?origin=HAN&destination=SGN&departDate=2025-11-17&returnDate=2025-11-24&adults=2&minors=1
```

**Trả về:** Danh sách chuyến bay với thông tin: `flightInstanceId`, `flightNumber`, giờ đi/đến, số ghế còn trống

**Lưu ý quan trọng:**
- Seed script đảm bảo mỗi route có ít nhất 1 daily schedule
- User có thể search bất kỳ route nào vào bất kỳ ngày nào trong tháng 12/2025
- Nếu không tìm thấy flights, frontend sẽ hiển thị toast notification ngay tại landing page (không navigate đến results page)

---

### Lấy danh sách loại vé
**GET** `/api/v1/search/fare-options`

**Authentication:** Optional (Bearer token trong header `Authorization`)

**Tham số:**
- `flightInstanceId` (optional): ID chuyến bay
  - **Nếu không truyền**: Backend tự động lấy từ booking state (nếu user đã đăng nhập và đã save cabin selection)
  - **Nếu truyền**: Sử dụng giá trị được truyền (override booking state)
  - **Lưu ý**: Nếu không truyền và không có booking state → 400 Bad Request
- `cabinType` (optional): `economy` hoặc `business`
  - **Nếu không truyền**: Backend tự động lấy từ booking state (nếu user đã đăng nhập và đã save cabin selection)
  - **Nếu truyền**: Sử dụng giá trị được truyền (override booking state)
  - **Lưu ý**: Nếu không truyền và không có booking state → 400 Bad Request

**Auto-fetch Logic:**
- Nếu user đã đăng nhập (có token hợp lệ) và đã save cabin selection:
  - Backend tự động lấy `flightInstanceId` và `cabinType` từ booking state
  - User không cần truyền query parameters
- Nếu user chưa đăng nhập hoặc chưa save cabin selection:
  - Phải truyền đầy đủ `flightInstanceId` và `cabinType`
- Query parameters luôn có priority cao hơn booking state (override)

**Trả về:** Danh sách các loại vé (Economy: Saver Max, Standard, Smart, Flex | Business: Standard, Smart, Flex) với giá và mô tả điều kiện

---

### Lấy bản đồ ghế ngồi
**GET** `/api/v1/search/seats`

**Authentication:** Optional (Bearer token trong header `Authorization`)

**Tham số:**
- `flightInstanceId` (bắt buộc): ID chuyến bay (UUID v7)
- `cabinType` (optional): `economy` hoặc `business`
  - **Nếu không truyền**: Backend tự động lấy từ booking state (nếu user đã đăng nhập và đã save cabin selection)
  - **Nếu truyền**: Sử dụng giá trị được truyền (override booking state)
  - **Lưu ý**: Nếu không truyền và không có booking state → 400 Bad Request

**Auto-fetch Logic:**
- Nếu user đã đăng nhập (có token hợp lệ) và đã save cabin selection:
  - Backend tự động lấy `cabinType` từ booking state
  - User chỉ cần truyền `flightInstanceId`
- Nếu user chưa đăng nhập hoặc chưa save cabin selection:
  - Phải truyền đầy đủ `flightInstanceId` và `cabinType`
- Query parameters luôn có priority cao hơn booking state (override)

**Trả về:** Bản đồ ghế được group theo cabin class với thông tin chi tiết. **API LUÔN TRẢ VỀ CẢ ECONOMY VÀ BUSINESS SEATS** (bất kể cabinType được request):

```json
{
  "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "flightNumber": "VN123",
  "cabinType": "economy",
  "seats": [
    {
      "id": "economy",
      "list": [
        {
          "flightSeatId": "019a8f4a-bb0e-7402-a0c4-27647b89dc72",
          "seatNumber": "10A",
          "cabinClassCode": "Y",
          "seatType": "window",
          "isExitRow": false,
          "position": "left",
          "isAvailable": true,
          "isSelectable": true,
          "note": "es"
        }
      ]
    },
    {
      "id": "business",
      "list": [
        {
          "flightSeatId": "019a8f4a-bb0e-7402-a0c4-27647b89dc73",
          "seatNumber": "1A",
          "cabinClassCode": "J",
          "seatType": "window",
          "isExitRow": false,
          "position": "left",
          "isAvailable": true,
          "isSelectable": false,
          "note": "bf"
        }
      ]
    }
  ]
}
```

**Giải thích các trường:**
- `flightSeatId`: UUID v7 - **Dùng để lưu vào booking state và tạo reservation**
- `seatNumber`: Số ghế (ví dụ: `1A`, `10B`, `12F`)
- `cabinClassCode`: Mã cabin class (`Y` = Economy, `J` = Business)
- `seatType`: Loại ghế (`window`, `aisle`, `middle`)
- `isExitRow`: Có phải ghế exit row không
- `position`: Vị trí (`left` hoặc `right`) - dùng để render UI
  - Economy: A-B-C = left, D-E-F = right
  - Business: A-B = left, C-D = right
- `isAvailable`: Ghế còn trống không (`true` = có thể chọn, `false` = đã được giữ/book)
- `isSelectable`: **NEW** - Ghế có thể chọn không dựa trên cabin type được request
  - `true`: Seat thuộc cabin type được request và `isAvailable = true` → User có thể chọn
  - `false`: Seat thuộc cabin type khác hoặc `isAvailable = false` → User không thể chọn (nhưng vẫn hiển thị)
- `note`: Mã note cho fare class (`ef` = Economy Flex, `es` = Economy Smart, `em` = Economy Saver Max, `bf` = Business Flex, `bs` = Business Smart)

**Cách hoạt động:**
1. API query **TẤT CẢ seats** của flight instance từ database (cả economy và business)
2. Group seats theo cabin class (economy và business)
3. Determine position (left/right) dựa vào seat number và cabin type của từng seat
4. Map fare class note codes cho từng cabin class
5. Đánh dấu `isSelectable` dựa trên cabin type được request:
   - Seats thuộc cabin type được request và `isAvailable = true` → `isSelectable = true`
   - Seats thuộc cabin type khác hoặc `isAvailable = false` → `isSelectable = false`
6. Trả về seat map với đầy đủ thông tin để frontend render UI (bao gồm cả 2 cabin sections)

**Lưu ý:**
- Chọn ghế là **BẮT BUỘC** sau khi chọn cabin
- Phải lấy `flightSeatId` từ response để lưu vào booking state
- **API luôn trả về cả economy và business seats** - Frontend nên check `isSelectable` để disable seats không thuộc cabin type đã chọn
- `isAvailable = false` nghĩa là ghế đã được giữ (reserved) hoặc đã được book
- `isSelectable = false` nghĩa là ghế không thuộc cabin type được request (nhưng vẫn hiển thị để UI không bị trống)
- Khi tạo reservation với `flightSeatId`, backend tự động mark seat as unavailable
- Xem thêm: `docs/design/SEAT_MAP_API_EXPLANATION.md` để hiểu chi tiết

---

## Booking State (Quản lý trạng thái đặt vé)

**Lưu ý:** Backend tự quản lý state trong Redis. Frontend chỉ cần gọi API để lưu và fetch state.

### Lưu cabin selection
**POST** `/api/v1/booking-state/cabin`

**Cần đăng nhập:** Có

```json
{
  "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "cabinType": "economy",
  "fareClassCode": "YS"
}
```

**Trả về:** `{ success: true, message: "Cabin selection saved successfully" }`

**Lưu ý:** State được lưu vào Redis với TTL 30 phút. Phải lưu cabin trước khi lưu seat.

---

### Lưu seat selection
**POST** `/api/v1/booking-state/seat`

**Cần đăng nhập:** Có

```json
{
  "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "flightSeatId": "019a8f4a-bb0e-7402-a0c4-27647b89dc72",
  "seatNumber": "12A"
}
```

**Trả về:** `{ success: true, message: "Seat selection saved successfully" }`

**Lưu ý:** Cabin phải được chọn trước. State được lưu vào Redis với TTL 30 phút.

---

### Lấy tất cả booking states
**GET** `/api/v1/booking-state`

**Cần đăng nhập:** Có

**Mục đích:** Lấy tất cả booking states của user (bao gồm `flightInstanceId`). **Frontend không cần lưu `flightInstanceId` vào session** - có thể lấy từ endpoint này.

**Trả về:**
```json
{
  "states": [
    {
      "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
      "cabin": {
        "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
        "cabinType": "economy",
        "fareClassCode": "YS"
      },
      "seat": {
        "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
        "flightSeatId": "019a8f4a-bb0e-7402-a0c4-27647b89dc72",
        "seatNumber": "12A"
      },
      "updatedAt": "2025-01-15T10:30:00Z"
    }
  ]
}
```

**Lưu ý:**
- Trả về array tất cả booking states của user
- Mỗi state có `flightInstanceId` - frontend có thể dùng để gọi các API khác
- Thường chỉ có 1 booking state (cho flight đang book)
- Nếu có nhiều, frontend có thể chọn state mới nhất (dựa vào `updatedAt`)

---

### Lấy booking state hiện tại (cho flight cụ thể)
**GET** `/api/v1/booking-state/:flightInstanceId`

**Cần đăng nhập:** Có

**Mục đích:** Verify state trước khi tạo reservation (best practice - recommended)

**Trả về:** 
```json
{
  "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "cabin": {
    "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
    "cabinType": "economy",
    "fareClassCode": "YS"
  },
  "seat": {
    "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
    "flightSeatId": "019a8f4a-bb0e-7402-a0c4-27647b89dc72",
    "seatNumber": "12A"
  },
  "updatedAt": "2025-01-15T10:30:00Z"
}
```

**Lưu ý:** 
- Recommended: Gọi API này trước khi tạo reservation để verify state đầy đủ
- State tự động expire sau 30 phút (TTL)
- State tự động được clear sau khi tạo reservation thành công

---

### Xóa booking state
**DELETE** `/api/v1/booking-state/:flightInstanceId`

**Cần đăng nhập:** Có

**Mục đích:** Xóa booking state để bắt đầu lại từ đầu (best practice - optional)

**Trả về:** `204 No Content` (idempotent - có thể gọi nhiều lần)

**Lưu ý:**
- Xóa toàn bộ booking state (cabin + seat) cho flight instance
- Idempotent: Có thể gọi nhiều lần, không gây lỗi nếu state không tồn tại
- State cũng tự động được clear sau khi tạo reservation thành công
- Hữu ích khi user muốn chọn lại cabin hoặc seat

---

## Reservations (Giữ chỗ)

### Tạo reservation (giữ chỗ 15 phút)
**POST** `/api/v1/reservations`

**Cần đăng nhập:** Không (Optional - Guest bookings được hỗ trợ)

```json
{
  "segments": [
    {
      "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
      "segmentType": "outbound"
    }
  ],
  "numberOfPassengers": 1,
  "currencyCode": "VND"
}
```

**Trả về:** `reservationId`, `reservationCode`, `totalAmount`, `expiresAt`, `ttl`

**Lưu ý:**
- **Backend tự động lấy cabin và seat từ Redis** - Không cần gửi `fareClassCode` và `flightSeatId` trong request
- Phải lưu cabin và seat trước khi tạo reservation (dùng `/api/v1/booking-state/cabin` và `/api/v1/booking-state/seat`)
- Reservation tự động hết hạn sau 15 phút
- Reservation được lưu vào Redis với TTL 15 phút
- Sau khi tạo reservation thành công, booking state sẽ được xóa khỏi Redis
- Hỗ trợ round-trip: thêm segment với `segmentType: "inbound"`

---

### Xem reservation
**GET** `/api/v1/reservations/:id`

**Cần đăng nhập:** Có

Có thể dùng `reservationId` (UUID) hoặc `reservationCode` (6 ký tự)

---

### Hủy reservation
**POST** `/api/v1/reservations/:id/cancel`

**Cần đăng nhập:** Có

---

## Bookings (Đặt vé)

### Tạo booking từ reservation
**POST** `/api/v1/bookings?reservationId=xxx`

**Cần đăng nhập:** Không (Optional - Guest bookings được hỗ trợ)

**Guest Booking (Không cần đăng nhập):**
- Contact information (fullname, email, phone) là **BẮT BUỘC**
- Passenger information phải được cung cấp đầy đủ (không thể dùng `passengerId`)
- Booking sẽ được tạo với `user_id = null`
- Passenger sẽ được tạo với `user_id = null`

**Authenticated Booking (Có đăng nhập):**
- Contact information là **OPTIONAL** (sẽ dùng thông tin user nếu không cung cấp)
- Có thể dùng `passengerId` để tái sử dụng passenger đã lưu
- Booking sẽ được liên kết với user account

**Guest Booking (Không cần đăng nhập):**
```json
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

**Authenticated Booking (Có đăng nhập):**
```json
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
  "contactFullname": "Nguyen Van A",  // Optional - sẽ dùng user info nếu không có
  "contactEmail": "nguyenvana@example.com",  // Optional
  "contactPhone": "0912345678",  // Optional
  "channel": "web"
}
```

**Hoặc dùng hành khách đã lưu (chỉ cho authenticated users):**
```json
{
  "passengers": [
    {
      "passengerId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
      "passengerType": "ADT"
    }
  ]
}
```

**Trả về:** `bookingId`, `pnrCode`, `totalAmount`, `currencyCode`, `status`

**Lưu ý:**
- Phải tạo từ reservation (bắt buộc có `reservationId`)
- Reservation sẽ tự động hủy sau khi tạo booking thành công
- **Guest bookings**: Contact info là bắt buộc, không thể dùng `passengerId`
- **Authenticated bookings**: Contact info là optional, có thể dùng `passengerId` để tái sử dụng
- Email xác nhận ticket được gửi tự động sau khi thanh toán thành công (không gửi email booking confirmation)

---

### Xem chi tiết fare
**GET** `/api/v1/bookings/:id/fare-details`

**Cần đăng nhập:** Không (Public endpoint)

**Trả về:** Thông tin loại vé đã chọn, điều kiện/quyền lợi, giá

---

### Xem thông tin thanh toán
**GET** `/api/v1/bookings/:id/payment-info`

**Cần đăng nhập:** Không (Public endpoint)

**Trả về:** `bookingId`, `pnrCode`, `totalAmount`, thông tin liên hệ, `status`

---

### Xem vé của tôi
**GET** `/api/v1/bookings/my-tickets`

**Cần đăng nhập:** Có

**Query Parameters:**
- `page`: Số trang (mặc định: 1)
- `limit`: Số vé mỗi trang (mặc định: 10)

**Trả về:** Danh sách vé đã đặt với phân trang, bao gồm:
- Thông tin vé: `ticketId`, `ticketNumber`, `pnrCode`
- Thông tin chuyến bay: `flightNumber`, `originAirport`, `destinationAirport`, `departureDateTime`, `arrivalDateTime`
- Thông tin hành khách: `passengerName`, `seatNumber`
- Thông tin giá: `fareClassName`, `totalAmount`, `currencyCode`
- **Thông tin hủy vé:**
  - `canCancel`: `true` nếu có thể hủy, `false` nếu không thể hủy
  - `cancellationDeadline`: Hạn hủy (nếu có thể hủy)
  - `cannotCancelReason`: Lý do không thể hủy (nếu không thể hủy)
  - `bookingStatus`: Trạng thái booking (`pending`, `confirmed`, `paid`, `cancelled`, `completed`)

**Logic kiểm tra `canCancel`:**
1. **Kiểm tra booking status trước:** Chỉ booking với status `pending` hoặc `confirmed` mới có thể hủy
   - Booking với status `paid`, `cancelled`, hoặc `completed` → `canCancel: false`
   - Lý do: "Không thể hủy booking với trạng thái: {status}. Chỉ có thể hủy booking với trạng thái 'pending' hoặc 'confirmed'."
2. **Kiểm tra fare class:** Economy Saver Max/Saver/Eco không được phép hủy
3. **Kiểm tra thời hạn:** 
   - Chặng bay nội địa: Tối thiểu 03 tiếng trước giờ khởi hành
   - Chặng bay quốc tế: Tối thiểu 05 tiếng trước giờ khởi hành

**Lưu ý:**
- `canCancel` được tính dựa trên booking status, fare class, và thời hạn hủy
- Frontend nên hiển thị đúng trạng thái dựa trên `canCancel` để tránh user click hủy nhưng backend từ chối
- Booking với status `paid` không thể hủy (đã thanh toán thành công)

---

### Xem hành trình của tôi
**GET** `/api/v1/bookings/my-journey`

**Cần đăng nhập:** Có

**Query Parameters:**
- `page`: Số trang (mặc định: 1)
- `limit`: Số hành trình mỗi trang (mặc định: 10)

**Trả về:** Danh sách hành trình đã đi với phân trang, bao gồm thông tin booking và chuyến bay

**Lưu ý quan trọng:**
- **Filter cancelled bookings:** API tự động loại bỏ các booking có status `cancelled` khỏi kết quả
- Chỉ hiển thị các hành trình chưa bị hủy (pending, confirmed, paid, completed)

---

### Hủy booking (Full Cancellation)
**PATCH** `/api/v1/bookings/:id/cancel`

**Cần đăng nhập:** Có

**Mô tả:** Hủy toàn bộ booking theo quy định Bamboo Airways. Hỗ trợ hủy booking với status `pending`, `confirmed`, hoặc `paid` (với OTP verification cho paid bookings).

**Validation:**
- Booking phải thuộc về user đang đăng nhập
- **Booking status:** `pending`, `confirmed`, hoặc `paid` (với OTP verification)
- Phải kiểm tra điều kiện hủy vé (fare class, thời hạn)
- Guest bookings không thể hủy qua API (phải liên hệ support)

**OTP Verification (cho paid bookings):**
- Nếu booking status là `paid`, cần verify OTP trước khi hủy:
  1. Gửi OTP: `POST /api/v1/auth/otp/cancellation/send` với `userId` và `bookingId`
  2. Verify OTP: `POST /api/v1/auth/otp/cancellation/verify` với `userId`, `bookingId`, và `otp`
  3. Sau khi verify thành công, gọi `PATCH /api/v1/bookings/:id/cancel` (không cần OTP trong body)

**Quy định hủy vé Bamboo Airways:**
- **Chặng bay nội địa:** Hoàn thiện thủ tục hoàn vé trước giờ khởi hành tối thiểu **03 tiếng**
- **Chặng bay quốc tế:** Thực hiện thủ tục hoàn vé trước giờ khởi hành ít nhất **05 tiếng**
- **Hạng vé được phép hoàn:** Economy Smart, Economy Flex, Premium Smart, Premium Flex, Business Smart, Business Flex
- **Hạng vé KHÔNG được phép hoàn:** Economy Saver Max (YSM, SMX), Economy Saver / Bamboo Eco (ECO, YS)

**Refund Calculation (cho paid bookings):**
- **Formula:** `Refund = Total Amount - Cancellation Fee - Non-refundable Fees`
- **Cancellation Fee:** Tính theo fare class (300,000 - 600,000 VND per segment)
- **Non-refundable Fees:** 10% của total amount (service fees, taxes)
- Refund amount được trả về trong response

**Trả về:**
```json
{
  "success": true,
  "message": "Booking cancelled successfully. Refund amount: 1,200,000 VND",
  "refundAmount": 1200000,
  "cancellationFee": 300000
}
```

**Lỗi có thể xảy ra:**
- `400 Bad Request`: "Cannot cancel booking with status: {status}" - Booking status không cho phép hủy
- `400 Bad Request`: "Booking is already cancelled" - Booking đã bị hủy trước đó
- `400 Bad Request`: "Cannot cancel booking: {reason}" - Không đáp ứng điều kiện hủy (fare class hoặc thời hạn)
- `400 Bad Request`: "OTP verification is required for cancelling paid bookings" - Cần verify OTP cho paid bookings
- `401 Unauthorized`: "Invalid or expired OTP" - OTP không hợp lệ hoặc đã hết hạn
- `404 Not Found`: "Booking not found" - Không tìm thấy booking
- `403 Forbidden`: "Booking does not belong to the current user" - Booking không thuộc về user

**Lưu ý quan trọng:**
- **Transaction-based:** Hủy booking, tickets, và segments được thực hiện trong một transaction để đảm bảo tính nhất quán
- **Email notification:** Tự động gửi email xác nhận hủy với thông tin refund (nếu có)

---

### Lấy thông tin ticket
**GET** `/api/v1/bookings/tickets/:ticketId/info`

**Cần đăng nhập:** Có

**Mô tả:** Lấy thông tin ticket bao gồm `bookingId` và `bookingStatus`. Dùng cho OTP verification flow khi cancel ticket.

**Trả về:**
```json
{
  "ticketId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "bookingId": "019a8f4a-bb0e-7402-a0c4-27647b89dc72",
  "bookingStatus": "paid"
}
```

---

### Hủy ticket (Partial Cancellation)
**PATCH** `/api/v1/bookings/tickets/:ticketId/cancel`

**Cần đăng nhập:** Có

**Mô tả:** Hủy một ticket riêng lẻ từ booking (partial cancellation). Nếu tất cả tickets trong booking đều bị hủy, booking sẽ tự động được hủy.

**Hybrid Cancellation Approach:**
- **Level 1: Cancel individual ticket** - Hủy từng ticket riêng lẻ
- **Level 2: Cancel entire booking** - Hủy toàn bộ booking (sử dụng `PATCH /api/v1/bookings/:id/cancel`)

**Flow:**
1. Validate ticket ownership và cancellation eligibility
2. Cancel ticket và related segment
3. Recalculate `booking.total_amount` (trừ segment amount đã hủy)
4. Check nếu tất cả tickets cancelled → auto cancel booking
5. Calculate và return refund amount (nếu booking was paid)

**Validation:**
- Ticket phải thuộc về user đang đăng nhập
- Ticket chưa bị hủy (`status !== 'cancelled'`)
- Booking status: `pending`, `confirmed`, hoặc `paid` (với OTP verification)
- Phải kiểm tra điều kiện hủy vé (fare class, thời hạn) cho segment liên quan

**OTP Verification (cho paid bookings):**
- Nếu booking status là `paid`, cần verify OTP trước khi hủy:
  1. Lấy ticket info: `GET /api/v1/bookings/tickets/:ticketId/info` để lấy `bookingId`
  2. Gửi OTP: `POST /api/v1/auth/otp/cancellation/send` với `userId` và `bookingId`
  3. Verify OTP: `POST /api/v1/auth/otp/cancellation/verify` với `userId`, `bookingId`, và `otp`
  4. Sau khi verify thành công, gọi `PATCH /api/v1/bookings/tickets/:ticketId/cancel` (không cần OTP trong body)

**Refund Calculation (cho paid bookings):**
- **Formula:** `Refund = Segment Amount - Cancellation Fee - Non-refundable Fees (proportional)`
- **Segment Amount:** `base_fare + tax_amount + fee_amount` của segment bị hủy
- **Cancellation Fee:** Tính theo fare class của segment
- **Non-refundable Fees:** 10% của segment amount (proportional)
- Refund amount được trả về trong response

**Auto-cancel Booking:**
- Nếu sau khi hủy ticket, tất cả tickets trong booking đều cancelled → booking tự động cancelled
- Response sẽ có `bookingCancelled: true` nếu booking được auto-cancel

**Trả về:**
```json
{
  "success": true,
  "message": "Ticket cancelled successfully.",
  "refundAmount": 600000,
  "cancellationFee": 300000,
  "bookingCancelled": false
}
```

**Nếu booking được auto-cancel:**
```json
{
  "success": true,
  "message": "Ticket cancelled successfully. All tickets in this booking have been cancelled, booking is now cancelled.",
  "refundAmount": 600000,
  "cancellationFee": 300000,
  "bookingCancelled": true
}
```

**Lỗi có thể xảy ra:**
- `400 Bad Request`: "Ticket is already cancelled" - Ticket đã bị hủy
- `400 Bad Request`: "Cannot cancel ticket for booking with status: {status}" - Booking status không cho phép hủy
- `400 Bad Request`: "This ticket cannot be cancelled due to fare class restrictions or time limits" - Không đáp ứng điều kiện hủy
- `400 Bad Request`: "OTP verification is required for cancelling tickets from paid bookings" - Cần verify OTP cho paid bookings
- `401 Unauthorized`: "Invalid or expired OTP" - OTP không hợp lệ hoặc đã hết hạn
- `404 Not Found`: "Ticket not found" - Không tìm thấy ticket
- `403 Forbidden`: "Ticket does not belong to the current user" - Ticket không thuộc về user

**Lưu ý quan trọng:**
- **Transaction-based:** Hủy ticket, segment, và recalculate booking amount được thực hiện trong một transaction
- **State consistency:** `booking.total_amount` được recalculate sau khi hủy ticket
- **Email notification:** Tự động gửi email xác nhận hủy với thông tin refund (nếu có)

---

## Payments (Thanh toán)

### Tạo thanh toán
**POST** `/api/v1/payments/bookings/:bookingId`

**Cần đăng nhập:** Có

```json
{
  "paymentMethodCode": "CREDIT_CARD",
  "amount": 1577000
}
```

**Trả về:** `paymentId`, `status`, `expiresAt`

**Lưu ý:**
- Payment tự động hết hạn sau 15 phút
- Phương thức thanh toán: `CREDIT_CARD`, `DEBIT_CARD`, `BANK_TRANSFER`, `EWALLET`, `CASH`

---

### Xử lý thanh toán
**POST** `/api/v1/payments/bookings/:bookingId/process`

**Cần đăng nhập:** Không (Optional - Guest bookings được hỗ trợ)

Tạo payment và xử lý thanh toán ngay. Có thể trả về `paymentUrl` để redirect đến cổng thanh toán.

**Lưu ý:**
- **Guest Bookings**: Hỗ trợ thanh toán cho guest users (không cần đăng nhập)
- **Already Paid Handling**: Nếu booking đã được thanh toán, frontend sẽ tự động redirect đến confirmation page
- **Email Notifications**: Email xác nhận thanh toán được gửi tự động qua RabbitMQ (async, non-blocking)
- **Ticket Creation**: Tickets được tạo tự động sau khi payment thành công qua RabbitMQ queue (async processing)
- **Booking Status**: Booking status tự động cập nhật thành `paid` khi thanh toán thành công
- **Error Handling**: 
  - "Booking is already paid" → Frontend tự động redirect đến confirmation
  - Improved error messages cho better user experience

---

### Xem thông tin payment
**GET** `/api/v1/payments/:id`

**Cần đăng nhập:** Không (Optional - Guest bookings được hỗ trợ)

**Lưu ý:**
- Guest users có thể xem payment details của booking của họ (không cần đăng nhập)
- Payment ownership được validate dựa trên booking ownership

---

### Xem tất cả payments của booking
**GET** `/api/v1/payments/bookings/:bookingId`

**Cần đăng nhập:** Có

---

## Services (Dịch vụ)

### Lấy danh sách deals
**GET** `/api/v1/services/deals`

**Trả về:** Danh sách ưu đãi chuyến bay với hình ảnh, tên route, ngày bay, giá

**Lưu ý:**
- Bao gồm cả one-way và round-trip deals
- Giá được tính từ dữ liệu booking có sẵn

---

## RabbitMQ Integration

### Overview
Hệ thống sử dụng RabbitMQ cho asynchronous messaging và event-driven architecture.

**Benefits:**
- **Non-blocking Operations**: Email notifications và ticket creation được xử lý async
- **Better Performance**: Payment và booking operations không bị block bởi email/ticket creation
- **Scalability**: Message queue cho phép xử lý high-volume operations
- **Resilience**: Automatic reconnection và fallback mechanisms

**Configuration:**
- **Management UI**: `http://localhost:15672` (admin/admin123)
- **Environment Variables**:
  - `RABBITMQ_HOST`: RabbitMQ host (default: localhost)
  - `RABBITMQ_PORT`: RabbitMQ port (default: 5672)
  - `RABBITMQ_USER`: RabbitMQ username (default: admin)
  - `RABBITMQ_PASS`: RabbitMQ password (default: admin123)
  - `RABBITMQ_QUEUE_EMAIL`: Email notifications queue (default: email_notifications)
  - `RABBITMQ_QUEUE_TICKET`: Ticket creation queue (default: ticket_creation)

**Queues:**
- `email_notifications`: Durable queue cho email notifications (payment success/failed, ticket confirmation)
- `ticket_creation`: Durable queue cho ticket creation sau payment thành công

**Flow:**
1. Payment thành công → Publish message to `ticket_creation` queue
2. Payment thành công/thất bại → Publish message to `email_notifications` queue
3. Consumers xử lý messages async (non-blocking)
4. Fallback: Nếu RabbitMQ không available, hệ thống tự động fallback sang TCP communication

**Lưu ý:**
- RabbitMQ integration là transparent cho frontend - API contracts không thay đổi
- Email và ticket creation vẫn hoạt động bình thường, chỉ cải thiện performance
- RabbitMQ service tự động reconnect nếu connection bị mất

---

## Emails (Gửi email)

### Gửi email
**POST** `/api/v1/emails/send`

**Cần đăng nhập:** Có

**Ví dụ gửi OTP:**
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

**Templates có sẵn:**
- `otp_payment` - OTP thanh toán
- `otp_password_reset` - OTP đặt lại mật khẩu
- `payment_success` - Xác nhận thanh toán thành công
- `payment_failed` - Thông báo thanh toán thất bại
- `ticket_confirmation` - Xác nhận vé với chi tiết đầy đủ (seat, cabin class, flight details, check-in time)

**Lưu ý:**
- **RabbitMQ Integration**: Emails được gửi qua RabbitMQ queue (async, non-blocking)
- **Fallback Mechanism**: Nếu RabbitMQ không available, hệ thống tự động fallback sang TCP communication
- **Email Queue**: `email_notifications` queue với durable messages và automatic retry
- **Performance**: Non-blocking email sending cải thiện response time cho payment và booking operations

---

### Kiểm tra trạng thái email service
**GET** `/api/v1/emails/health`

**Không cần đăng nhập**

---

## Danh sách sân bay nội địa

- **HAN**: Hà Nội (Noi Bai)
- **SGN**: TP. Hồ Chí Minh (Tan Son Nhat)
- **DAD**: Đà Nẵng (Da Nang)
- **CXR**: Nha Trang (Cam Ranh)
- **PQC**: Phú Quốc
- **UIH**: Quy Nhơn
- Và các sân bay khác...

---

## Xử lý lỗi

### Mã lỗi phổ biến

- **200 OK**: Thành công
- **201 Created**: Tạo mới thành công
- **400 Bad Request**: Dữ liệu không hợp lệ hoặc thiếu tham số (business logic errors)
- **401 Unauthorized**: Chưa đăng nhập hoặc token không hợp lệ, hoặc OTP không hợp lệ/hết hạn
- **404 Not Found**: Không tìm thấy (chuyến bay, booking, payment, user...)
- **503 Service Unavailable**: Dịch vụ tạm thời không khả dụng (infrastructure errors)

### Phân loại lỗi (Best Practice)

**Infrastructure Errors (503 Service Unavailable):**
- Microservice không chạy (Connection refused, Connection closed)
- Timeout errors (ETIMEDOUT)
- Network errors giữa API Gateway và Microservices

**Business Logic Errors (400 Bad Request / 404 Not Found):**
- Validation errors (missing required fields, invalid format)
- Business rule violations (missing cabin/seat selection, not enough seats)
- Resource not found (404)

### Ví dụ lỗi

**400 Bad Request (Business Logic Error):**
```json
{
  "statusCode": 400,
  "message": ["email must be an email", "password must be longer than or equal to 6 characters"],
  "error": "Bad Request"
}
```

**503 Service Unavailable (Infrastructure Error):**
```json
{
  "statusCode": 503,
  "timestamp": "2025-11-23T14:13:56.784Z",
  "path": "/api/v1/reservations",
  "method": "POST",
  "requestId": "019ab110-73a2-71da-b086-982c9d6eafcf",
  "message": "Reservation microservice connection was closed. Please ensure the service is running.",
  "error": "Service Unavailable"
}
```

**400 Bad Request (Missing Cabin/Seat Selection):**
```json
{
  "statusCode": 400,
  "message": "Cannot create reservation: Cabin not selected for flight 019a8f4a-bb0e-7402-a0c4-27647b89dc71. Please select cabin first. Please select cabin and seat first using /api/v1/booking-state endpoints.",
  "error": "Bad Request"
}
```

### Error Handling cho Reservation API

**503 Service Unavailable:**
- Xảy ra khi Reservation Microservice không chạy hoặc connection bị đóng
- **Troubleshooting**: Kiểm tra Reservation Microservice có đang chạy không (`npm run start:reservation:dev`)
- **Error messages:**
  - "Reservation microservice is not available. Please ensure the service is running."
  - "Reservation microservice connection was closed. Please ensure the service is running."
  - "Reservation microservice request timeout. The service may be unavailable or overloaded."

**400 Bad Request:**
- Validation errors: Missing required fields, invalid UUID format
- Business logic errors: Missing cabin/seat selection, not enough seats, invalid flight instance
- **Error messages:**
  - "Cannot create reservation: Cabin not selected for flight {flightInstanceId}. Please select cabin first."
  - "Cannot create reservation: Seat not selected for flight {flightInstanceId}. Please select seat after cabin selection."
  - "Flight instance {flightInstanceId} not found"

---

## Ví dụ sử dụng

### JavaScript (Fetch)

```javascript
// Đăng nhập
const loginResponse = await fetch('http://localhost:3000/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'StrongP@ssw0rd'
  })
});
const { access_token } = await loginResponse.json();

// Tìm kiếm chuyến bay
const flightsResponse = await fetch(
  'http://localhost:3000/api/v1/search/flights?origin=HAN&destination=SGN&departDate=2025-11-17&adults=1&minors=0'
);
const flights = await flightsResponse.json();

// Tạo booking (cần token)
const bookingResponse = await fetch('http://localhost:3000/api/v1/bookings?reservationId=xxx', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    passengers: [{
      passengerType: 'ADT',
      fullname: 'Nguyen Van A',
      dob: '1990-01-15',
      gender: 'Male',
      documentNumber: '001234567890'
    }]
  })
});
```

---

## Luồng đặt vé hoàn chỉnh

### Authenticated Flow (Có đăng nhập)

1. **Tìm kiếm** → `GET /api/v1/search/flights`
2. **Chọn chuyến bay** → Lấy `flightInstanceId`
3. **Xem loại vé** → `GET /api/v1/search/fare-options?flightInstanceId=xxx&cabinType=economy` (cả 2 đều optional)
   - **Lần đầu**: Truyền `flightInstanceId` (từ search results - component state) và `cabinType` (user selection)
   - **Lần sau**: Nếu đã save cabin selection, có thể gọi lại mà không cần truyền (backend tự động lấy từ booking state)
4. **Lưu cabin selection** → `POST /api/v1/booking-state/cabin` (Backend lưu vào Redis) - **Cần đăng nhập**
5. **Xem ghế** → `GET /api/v1/search/seats` → Lấy `flightSeatId` và `seatNumber`
6. **Lưu seat selection** → `POST /api/v1/booking-state/seat` (Backend lưu vào Redis) - **Cần đăng nhập**
7. **Verify state (Optional - Recommended)** → `GET /api/v1/booking-state/:flightInstanceId` (Best practice: verify trước khi tạo reservation)
8. **Giữ chỗ 15 phút** → `POST /api/v1/reservations` (Backend tự động lấy cabin + seat từ Redis, lưu reservation vào Redis với TTL 15 phút, tự động clear booking state sau khi thành công) - **Optional auth**
9. **Điền thông tin** → Tạo booking → `POST /api/v1/bookings?reservationId=xxx` (Contact info optional - sẽ dùng user info) - **Optional auth**
10. **Thanh toán** → `POST /api/v1/payments/bookings/:bookingId/process`

### Guest Flow (Không cần đăng nhập)

1. **Tìm kiếm** → `GET /api/v1/search/flights` (Public)
2. **Chọn chuyến bay** → Lấy `flightInstanceId`
3. **Xem loại vé** → `GET /api/v1/search/fare-options?flightInstanceId=xxx&cabinType=economy` (Phải truyền đầy đủ params)
4. **Lưu cabin selection** → `POST /api/v1/booking-state/cabin` - **Cần đăng nhập** (Hiện tại guest chưa hỗ trợ booking state)
5. **Xem ghế** → `GET /api/v1/search/seats?flightInstanceId=xxx&cabinType=economy` (Phải truyền đầy đủ params)
6. **Lưu seat selection** → `POST /api/v1/booking-state/seat` - **Cần đăng nhập** (Hiện tại guest chưa hỗ trợ booking state)
7. **Giữ chỗ 15 phút** → `POST /api/v1/reservations` (Không cần token, nhưng cần có booking state - hiện tại vẫn cần đăng nhập để tạo state)
8. **Điền thông tin** → Tạo booking → `POST /api/v1/bookings?reservationId=xxx` (Contact info **BẮT BUỘC**) - **Không cần token**
9. **Thanh toán** → `POST /api/v1/payments/bookings/:bookingId/process`

**Lưu ý:** 
- Backend tự quản lý toàn bộ state trong Redis. Frontend chỉ cần gọi API để lưu và fetch, không cần gửi lại cabin/seat trong request tạo reservation.
- **Guest bookings**: Contact information là bắt buộc, không thể dùng `passengerId`
- **Authenticated bookings**: Contact information là optional, có thể dùng `passengerId` để tái sử dụng passenger đã lưu
- Email xác nhận ticket được gửi tự động sau khi thanh toán thành công (không gửi email booking confirmation)
- Email xác nhận thanh toán được gửi tự động khi thanh toán thành công/thất bại
- Reservation tự động hủy sau khi tạo booking
- Payment tự động hết hạn sau 15 phút

---

## Real-time WebSocket Communication

Hệ thống hỗ trợ real-time communication qua WebSocket (Socket.IO) cho các critical business flows.

### WebSocket Endpoint

```
ws://localhost:3000/realtime
```

**Namespace**: `/realtime` (Socket.IO)

### Authentication

WebSocket connection hỗ trợ 2 cách authentication:

1. **JWT Token** (Authenticated users):
   - Gửi token trong `auth.token` hoặc `Authorization` header
   - Format: `Bearer <access_token>`

2. **Session ID** (Guest users):
   - Gửi session ID trong `auth.sessionId` hoặc query parameter `sessionId`

**Connection Example (Socket.IO Client)**:
```typescript
import { io } from 'socket.io-client';

// Authenticated user
const socket = io('http://localhost:3000/realtime', {
  auth: {
    token: 'your-jwt-token'
  }
});

// Guest user
const socket = io('http://localhost:3000/realtime', {
  auth: {
    sessionId: 'your-session-id'
  }
});
```

### Events

#### Client → Server Events

##### Subscribe to Seat Availability Updates

**Event**: `subscribe:seat-availability`

**Payload**:
```json
{
  "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71"
}
```

**Response Event**: `subscribed:seat-availability`
```json
{
  "success": true,
  "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71"
}
```

**Mô tả**: Subscribe để nhận real-time updates khi seat availability thay đổi cho một flight instance. Giúp tránh conflict khi nhiều user cùng chọn ghế.

---

##### Unsubscribe from Seat Availability Updates

**Event**: `unsubscribe:seat-availability`

**Payload**:
```json
{
  "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71"
}
```

**Response Event**: `unsubscribed:seat-availability`
```json
{
  "success": true,
  "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71"
}
```

---

##### Subscribe to Reservation Countdown Timer

**Event**: `subscribe:reservation-countdown`

**Payload**:
```json
{
  "reservationId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71"
}
```

**Response Event**: `subscribed:reservation-countdown`
```json
{
  "success": true,
  "reservationId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71"
}
```

**Mô tả**: Subscribe để nhận real-time countdown updates cho reservation. Server là source of truth, sync mỗi giây để tránh client-side timer drift. Business critical - đảm bảo accuracy của countdown timer.

---

##### Unsubscribe from Reservation Countdown

**Event**: `unsubscribe:reservation-countdown`

**Payload**:
```json
{
  "reservationId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71"
}
```

**Response Event**: `unsubscribed:reservation-countdown`
```json
{
  "success": true,
  "reservationId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71"
}
```

---

##### Subscribe to Payment Status Updates

**Event**: `subscribe:payment-status`

**Payload**:
```json
{
  "bookingId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "paymentId": "019a8f4a-bb0e-7402-a0c4-27647b89dc72" // Optional
}
```

**Response Event**: `subscribed:payment-status`
```json
{
  "success": true,
  "bookingId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "paymentId": "019a8f4a-bb0e-7402-a0c4-27647b89dc72"
}
```

**Mô tả**: Subscribe để nhận real-time updates khi payment status thay đổi. UX critical - immediate feedback khi payment thành công/thất bại.

---

##### Unsubscribe from Payment Status

**Event**: `unsubscribe:payment-status`

**Payload**:
```json
{
  "bookingId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71"
}
```

**Response Event**: `unsubscribed:payment-status`
```json
{
  "success": true,
  "bookingId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71"
}
```

---

#### Server → Client Events

##### Connection Confirmed

**Event**: `connected`

**Payload**:
```json
{
  "success": true,
  "socketId": "abc123",
  "userId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71", // Nếu authenticated
  "sessionId": "session-123" // Nếu guest
}
```

**Mô tả**: Được emit ngay sau khi connection thành công và authentication hoàn tất.

---

##### Seat Availability Update

**Event**: `seat-availability:update`

**Payload**:
```json
{
  "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "changes": [
    {
      "flightSeatId": "019a8f4a-bb0e-7402-a0c4-27647b89dc72",
      "seatNumber": "12A",
      "status": "reserved",
      "changedBy": "019a8f4a-bb0e-7402-a0c4-27647b89dc71"
    }
  ],
  "timestamp": "2025-12-01T10:00:00.000Z"
}
```

**Mô tả**: Được emit khi seat availability thay đổi (reserve/release). Tất cả clients subscribed đến flight instance đó sẽ nhận update.

**Status Values**:
- `available`: Ghế available
- `reserved`: Ghế đã được reserve

---

##### Reservation Countdown Update

**Event**: `reservation-countdown:update`

**Payload**:
```json
{
  "reservationId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "remainingSeconds": 899,
  "expiresAt": "2025-12-01T10:15:00.000Z",
  "isExpired": false
}
```

**Mô tả**: Được emit mỗi giây cho active reservations. Server là source of truth, đảm bảo accuracy.

---

##### Reservation Expired

**Event**: `reservation-countdown:expired`

**Payload**:
```json
{
  "reservationId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "expiresAt": "2025-12-01T10:15:00.000Z"
}
```

**Mô tả**: Được emit khi reservation hết hạn (remainingSeconds = 0).

---

##### Payment Status Update

**Event**: `payment-status:update`

**Payload**:
```json
{
  "bookingId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "paymentId": "019a8f4a-bb0e-7402-a0c4-27647b89dc72",
  "status": "success",
  "timestamp": "2025-12-01T10:00:00.000Z",
  "metadata": {
    "transactionRef": "TXN123456"
  }
}
```

**Mô tả**: Được emit khi payment status thay đổi. Immediate feedback cho user.

**Status Values**:
- `pending`: Payment đang được xử lý
- `success`: Payment thành công
- `failed`: Payment thất bại

---

##### Error Event

**Event**: `error`

**Payload**:
```json
{
  "message": "Connection failed"
}
```

**Mô tả**: Được emit khi có lỗi xảy ra (connection failed, authentication failed, subscription failed, etc.).

---

### Redis Channels

Hệ thống sử dụng Redis Pub/Sub để broadcast events across multiple API Gateway instances:

- `seat:availability:{flightInstanceId}` - Seat availability updates
- `payment:status:booking:{bookingId}` - Payment status by booking
- `payment:status:payment:{paymentId}` - Payment status by payment

### Best Practices

1. **Always unsubscribe** khi component unmount để tránh memory leaks
2. **Handle connection errors** gracefully - implement reconnection logic
3. **Use server as source of truth** cho countdown timer - không dùng client-side timer
4. **Publish events immediately** khi state changes trong backend
5. **Use Redis Pub/Sub** cho multi-instance deployments
6. **BE manages state** - Frontend chỉ hiển thị, không quản lý state

### Frontend Integration

**Xem chi tiết**: 
- [Real-time Implementation Guide](../REALTIME_IMPLEMENTATION.md)
- [Real-time Module README](../../src/api-gateway/modules/realtime/README.md)
- [Real-time Integration Guide](../../src/api-gateway/modules/realtime/INTEGRATION.md)

**Dependencies**:
```bash
cd booking
npm install socket.io-client
```

**Example Usage**:
```typescript
import { useSeatAvailability } from '@/app/hooks/use-seat-availability';
import { useReservationCountdown } from '@/app/hooks/use-reservation-countdown';
import { usePaymentStatus } from '@/app/hooks/use-payment-status';
```

---

## Các dịch vụ cần chạy

- **Search Microservice** (cổng 4001): `npm run start:search:dev`
- **Booking Microservice** (cổng 4004): `npm run start:booking:dev`
- **Reservation Microservice** (cổng 4005): `npm run start:reservation:dev` + Redis
- **Payment Microservice** (cổng 4006): `npm run start:payment:dev`
- **Email Microservice** (cổng 4007): `npm run start:email:dev`
- **Services Microservice** (cổng 4002): `npm run start:services:dev` (nếu dùng deals API)
- **Redis**: Cần cho Reservation Service, Booking State, và WebSocket Pub/Sub
