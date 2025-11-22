# API Documentation - Flight Booking Backend

**Lưu ý:** Hệ thống chỉ hỗ trợ bay nội địa Việt Nam.

## Base URL

```
http://localhost:3000
```

**Swagger UI**: `http://localhost:3000/api-docs`

## Lưu ý quan trọng

### Xác thực
- Một số API cần đăng nhập trước
- Sau khi đăng nhập, gửi token trong header: `Authorization: Bearer <access_token>`
- Token có hiệu lực 15 phút, dùng `refresh_token` để lấy token mới

### Định dạng
- ID: Tất cả ID là mã UUID dạng `xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx`
- Ngày: Format `YYYY-MM-DD` (ví dụ: `2025-11-17`)

### Luồng đặt vé
1. Tìm kiếm chuyến bay
2. Chọn loại vé
3. Giữ chỗ 15 phút (reservation)
4. Điền thông tin hành khách
5. Tạo booking
6. Thanh toán

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

```json
{
  "userId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71"
}
```

- OTP được gửi đến email
- Hết hạn sau 15 phút

---

### Xác thực OTP thanh toán
**POST** `/api/v1/auth/otp/payment/verify`

```json
{
  "userId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "otp": "123456"
}
```

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
- `tripType` (tùy chọn): `one_way` hoặc `round_trip`
  - Nếu không truyền: Có `returnDate` → `round_trip`, không có → `one_way`
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

**Tham số:**
- `flightInstanceId` (bắt buộc): ID chuyến bay
- `cabinType` (bắt buộc): `economy` hoặc `business`

**Trả về:** Danh sách các loại vé (Economy: Saver Max, Standard, Smart, Flex | Business: Standard, Smart, Flex) với giá và mô tả điều kiện

---

### Lấy bản đồ ghế ngồi
**GET** `/api/v1/search/seats`

**Tham số:**
- `flightInstanceId` (bắt buộc): ID chuyến bay
- `cabinType` (bắt buộc): `economy` hoặc `business`

**Trả về:** Danh sách ghế với thông tin: `flightSeatId`, `seatNumber`, `seatType`, `isAvailable`

**Lưu ý:** Chọn ghế là tùy chọn. Nếu chọn, lấy `flightSeatId` để gửi khi tạo reservation.

---

## Reservations (Giữ chỗ)

### Tạo reservation (giữ chỗ 15 phút)
**POST** `/api/v1/reservations`

**Cần đăng nhập:** Có

```json
{
  "segments": [
    {
      "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
      "fareClassCode": "YS",
      "segmentType": "outbound",
      "flightSeatId": "019a8f4a-bb0e-7402-a0c4-27647b89dc72"
    }
  ],
  "numberOfPassengers": 1,
  "currencyCode": "VND"
}
```

**Trả về:** `reservationId`, `reservationCode`, `totalAmount`, `expiresAt`, `ttl`

**Lưu ý:**
- Reservation tự động hết hạn sau 15 phút
- `flightSeatId` là tùy chọn (nếu đã chọn ghế)
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

**Cần đăng nhập:** Có

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
  "contactPhone": "0912345678"
}
```

**Hoặc dùng hành khách đã lưu:**
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
- Email xác nhận đặt chỗ được gửi tự động

---

### Xem chi tiết fare
**GET** `/api/v1/bookings/:id/fare-details`

**Trả về:** Thông tin loại vé đã chọn, điều kiện/quyền lợi, giá

---

### Xem thông tin thanh toán
**GET** `/api/v1/bookings/:id/payment-info`

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

**Cần đăng nhập:** Có

Tạo payment và xử lý thanh toán ngay. Có thể trả về `paymentUrl` để redirect đến cổng thanh toán.

**Lưu ý:**
- Email xác nhận thanh toán được gửi tự động khi thành công/thất bại
- Booking status tự động cập nhật thành `paid` khi thanh toán thành công

---

### Xem thông tin payment
**GET** `/api/v1/payments/:id`

**Cần đăng nhập:** Có

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
- `booking_confirmation` - Xác nhận đặt chỗ

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
- **400 Bad Request**: Dữ liệu không hợp lệ hoặc thiếu tham số
- **401 Unauthorized**: Chưa đăng nhập hoặc token không hợp lệ
- **404 Not Found**: Không tìm thấy (chuyến bay, booking, payment...)
- **503 Service Unavailable**: Dịch vụ tạm thời không khả dụng

### Ví dụ lỗi

```json
{
  "statusCode": 400,
  "message": ["email must be an email", "password must be longer than or equal to 6 characters"],
  "error": "Bad Request"
}
```

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

1. **Tìm kiếm** → `GET /api/v1/search/flights`
2. **Chọn chuyến bay** → Lấy `flightInstanceId`
3. **Xem loại vé** → `GET /api/v1/search/fare-options`
4. **Xem ghế** (tùy chọn) → `GET /api/v1/search/seats`
5. **Giữ chỗ 15 phút** → `POST /api/v1/reservations`
6. **Điền thông tin** → Tạo booking → `POST /api/v1/bookings?reservationId=xxx`
7. **Thanh toán** → `POST /api/v1/payments/bookings/:bookingId/process`

**Lưu ý:**
- Email xác nhận đặt chỗ được gửi tự động sau khi tạo booking
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
