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
- **Required Authentication**: Một số API bắt buộc đăng nhập (ví dụ: `GET /api/v1/bookings/my-tickets`, `GET /api/v1/bookings/my-journey`, `POST /api/v1/booking-state/cabin`, `POST /api/v1/booking-state/seat`)
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

## Search Flights (Tìm kiếm chuyến bay)

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

## Các dịch vụ cần chạy

- **Search Microservice** (cổng 4001): `npm run start:search:dev`
- **Booking Microservice** (cổng 4004): `npm run start:booking:dev`
- **Reservation Microservice** (cổng 4005): `npm run start:reservation:dev` + Redis
- **Payment Microservice** (cổng 4006): `npm run start:payment:dev`
- **Email Microservice** (cổng 4007): `npm run start:email:dev`
- **Services Microservice** (cổng 4002): `npm run start:services:dev` (nếu dùng deals API)
