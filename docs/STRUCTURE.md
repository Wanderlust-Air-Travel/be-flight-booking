# Cấu trúc Backend - Flight Booking

## Tổng quan

Hệ thống được chia thành nhiều phần nhỏ (microservices) để dễ quản lý:

- **API Gateway** (cổng 3000): Cổng vào duy nhất - nơi ứng dụng web gọi API
- **Microservices**: Các dịch vụ xử lý từng chức năng riêng (tìm kiếm, đặt chỗ, thanh toán...)
- **Database**: Tất cả dịch vụ dùng chung một cơ sở dữ liệu

## Cách hệ thống hoạt động

### Ví dụ: Tìm kiếm chuyến bay

```
Ứng dụng web → API Gateway (cổng 3000)
                ↓
            Kiểm tra yêu cầu
                ↓
            Gửi đến dịch vụ tìm kiếm
                ↓
            Dịch vụ tìm kiếm tìm trong database
                ↓
            Trả kết quả về API Gateway
                ↓
            API Gateway → Ứng dụng web
```

## Các dịch vụ chính

1. **Dịch vụ Tìm kiếm** (cổng 4001)
   - Tìm chuyến bay theo điều kiện
   - Xem thông tin giá vé
   - Xem bản đồ ghế

2. **Dịch vụ Đặt chỗ** (cổng 4004)
   - Tạo booking
   - Xem chi tiết booking
   - Gửi email xác nhận đặt chỗ tự động

3. **Dịch vụ Giữ chỗ** (cổng 4005)
   - Giữ chỗ tạm thời trong 15 phút
   - Tự động hủy nếu quá hạn

4. **Dịch vụ Thanh toán** (cổng 4006)
   - Tạo thanh toán
   - Xử lý thanh toán
   - Gửi email xác nhận thanh toán tự động

5. **Dịch vụ Email** (cổng 4007)
   - Gửi email OTP
   - Gửi email thông báo
   - Quản lý hàng đợi email

## API Endpoints chính

### Base URL
- **API Gateway**: `http://localhost:3000`
- **Tài liệu API**: `http://localhost:3000/api-docs`

### Xác thực
- `POST /api/v1/auth/register` - Đăng ký
- `POST /api/v1/auth/login` - Đăng nhập
- `POST /api/v1/auth/otp/payment/send` - Gửi OTP thanh toán
- `POST /api/v1/auth/otp/payment/verify` - Xác thực OTP thanh toán
- `POST /api/v1/auth/otp/password-reset/send` - Gửi OTP đặt lại mật khẩu
- `POST /api/v1/auth/otp/password-reset/verify` - Xác thực OTP và đặt lại mật khẩu

### Tìm kiếm
- `GET /api/v1/search/flights` - Tìm chuyến bay
- `GET /api/v1/search/fare-options` - Xem các loại vé
- `GET /api/v1/search/seats` - Xem bản đồ ghế

### Đặt chỗ
- `POST /api/v1/bookings` - Tạo booking mới
- `GET /api/v1/bookings/:id/fare-details` - Xem chi tiết vé
- `GET /api/v1/bookings/:id/payment-info` - Xem thông tin thanh toán

### Giữ chỗ
- `POST /api/v1/reservations` - Tạo reservation (giữ chỗ 15 phút)
- `GET /api/v1/reservations/:id` - Xem reservation

### Thanh toán
- `POST /api/v1/payments/bookings/:bookingId` - Tạo thanh toán
- `POST /api/v1/payments/bookings/:bookingId/process` - Xử lý thanh toán

## Tính năng tự động

### Email thông báo
- Email xác nhận đặt chỗ tự động sau khi tạo booking
- Email xác nhận thanh toán tự động khi thanh toán thành công/thất bại
- Email gửi ngầm, không làm chậm quá trình xử lý

### OTP (Mã xác thực)
- OTP thanh toán: Hết hạn sau 15 phút
- OTP đặt lại mật khẩu: Hết hạn sau 10 phút
- Mã OTP chỉ dùng được một lần, tự động xóa sau khi xác thực

### Giữ chỗ tự động
- Reservation tự động hết hạn sau 15 phút
- Tự động hủy nếu không tạo booking

## Cách chạy hệ thống

### Khởi động API Gateway
```bash
npm run start:dev
```

### Khởi động các dịch vụ
```bash
# Dịch vụ tìm kiếm
npm run start:search:dev

# Dịch vụ đặt chỗ
npm run start:booking:dev

# Dịch vụ giữ chỗ
npm run start:reservation:dev

# Dịch vụ thanh toán
npm run start:payment:dev

# Dịch vụ email
npm run start:email:dev
```

### Khởi động Redis (cần cho giữ chỗ)
```bash
docker-compose up -d redis
```

## Lưu ý cho người dùng

1. **Chỉ gọi API qua API Gateway** (cổng 3000)
2. **Xem tài liệu API** tại `http://localhost:3000/api-docs`
3. **Tìm kiếm chuyến bay**:
   - Không cần truyền loại chuyến (một chiều/khứ hồi)
   - Hệ thống tự động nhận biết: Có ngày về → khứ hồi, không có → một chiều
4. **Email thông báo** được gửi tự động, không cần làm gì thêm
5. **Mã OTP** được gửi qua email, kiểm tra hộp thư để lấy mã

## Cấu trúc thư mục

```
src/
├── api-gateway/          # Cổng API (cổng 3000)
├── microservices/        # Các dịch vụ
│   ├── search/           # Dịch vụ tìm kiếm
│   ├── booking/          # Dịch vụ đặt chỗ
│   ├── reservation/      # Dịch vụ giữ chỗ
│   ├── payment/          # Dịch vụ thanh toán
│   └── email/            # Dịch vụ email
└── shared/               # Code dùng chung
```
