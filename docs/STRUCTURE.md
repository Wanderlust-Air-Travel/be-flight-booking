# Cấu trúc Backend - Flight Booking

## Tổng quan

Hệ thống được chia thành nhiều phần nhỏ (microservices) để dễ quản lý:

- **API Gateway** (cổng 3000): Cổng vào duy nhất - nơi ứng dụng web gọi API (REST + WebSocket)
- **Microservices**: Các dịch vụ xử lý từng chức năng riêng (tìm kiếm, đặt chỗ, thanh toán...)
- **Database**: Tất cả dịch vụ dùng chung một cơ sở dữ liệu
- **Real-time Communication**: WebSocket Gateway cho real-time updates (seat availability, reservation countdown, payment status)

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
   - Tạo booking (hỗ trợ cả guest và authenticated bookings)
   - Xem chi tiết booking
   - Xem "My Tickets" và "My Journey" (chỉ cho authenticated users)
   - Gửi email xác nhận ticket tự động sau khi thanh toán thành công

3. **Dịch vụ Giữ chỗ** (cổng 4005)
   - Giữ chỗ tạm thời trong 15 phút (hỗ trợ cả guest và authenticated bookings)
   - Tự động hủy nếu quá hạn
   - Lưu reservation vào Redis với TTL 15 phút

4. **Dịch vụ Thanh toán** (cổng 4006)
   - Tạo thanh toán
   - Xử lý thanh toán
   - Gửi email xác nhận thanh toán tự động

5. **Dịch vụ Email** (cổng 4007)
   - Gửi email OTP
   - Gửi email thông báo
   - Quản lý hàng đợi email

6. **Admin Module** (cổng 3000, API Gateway)
   - Quản lý giá vé theo route (Route Fare Price Management) - REVENUE_ANALYST
   - Quản lý quy định hành lý (Baggage Allowance Management) - ANCILLARY_MANAGER
   - Quản lý dịch vụ cabin (Cabin Service Management) - ANCILLARY_MANAGER
   - Quản lý hạng vé (Fare Class Management) - REVENUE_ANALYST
   - Quản lý lịch chuyến bay (Flight Schedule Management) - SCHEDULE_PLANNER
   - Quản lý chuyến bay thực tế (Flight Instance Management) - SCHEDULE_PLANNER
   - Quản lý quyền người dùng (User Role Management) - ADMIN
   - Role-Based Access Control (RBAC) - Phân quyền dựa trên vai trò

7. **Real-time WebSocket Gateway** (cổng 3000, namespace `/realtime`)
   - **Seat Availability Updates**: Real-time seat status changes để tránh conflict
   - **Reservation Countdown Timer**: Server-synced countdown timer (business critical)
   - **Payment Status Updates**: Real-time payment confirmation (UX critical)
   - Sử dụng Redis Pub/Sub để broadcast events across multiple instances
   - Hỗ trợ cả authenticated users (JWT) và guest users (Session ID)

## API Endpoints chính

### Base URL
- **API Gateway**: `http://localhost:3000`
- **Tài liệu API**: `http://localhost:3000/api-docs`
- **WebSocket Endpoint**: `ws://localhost:3000/realtime` (Socket.IO namespace)

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
- `POST /api/v1/bookings?reservationId=xxx` - Tạo booking mới (Optional auth - hỗ trợ guest bookings)
- `GET /api/v1/bookings/:id/fare-details` - Xem chi tiết vé (Public endpoint)
- `GET /api/v1/bookings/:id/payment-info` - Xem thông tin thanh toán (Public endpoint)
- `GET /api/v1/bookings/my-tickets` - Xem vé của tôi (Requires auth)
- `GET /api/v1/bookings/my-journey` - Xem hành trình của tôi (Requires auth)

### Giữ chỗ
- `POST /api/v1/reservations` - Tạo reservation (giữ chỗ 15 phút) (Optional auth - hỗ trợ guest bookings)
- `GET /api/v1/reservations/:id` - Xem reservation

### Thanh toán
- `POST /api/v1/payments/bookings/:bookingId` - Tạo thanh toán
- `POST /api/v1/payments/bookings/:bookingId/process` - Xử lý thanh toán

### Admin (Quản trị hệ thống)

#### Route Fare Price Management (REVENUE_ANALYST)
- `POST /api/v1/admin/route-fare-prices` - Tạo giá vé theo route
- `GET /api/v1/admin/route-fare-prices` - Lấy tất cả giá vé
- `GET /api/v1/admin/route-fare-prices/:id` - Lấy giá vé theo ID
- `PUT /api/v1/admin/route-fare-prices/:id` - Cập nhật giá vé
- `DELETE /api/v1/admin/route-fare-prices/:id` - Xóa giá vé

#### Baggage Allowance Management (ANCILLARY_MANAGER)
- `POST /api/v1/admin/baggage-allowances` - Tạo quy định hành lý
- `GET /api/v1/admin/baggage-allowances` - Lấy tất cả quy định hành lý
- `GET /api/v1/admin/baggage-allowances/:id` - Lấy quy định hành lý theo ID
- `PUT /api/v1/admin/baggage-allowances/:id` - Cập nhật quy định hành lý
- `DELETE /api/v1/admin/baggage-allowances/:id` - Xóa quy định hành lý

#### Cabin Service Management (ANCILLARY_MANAGER)
- `POST /api/v1/admin/cabin-services` - Tạo dịch vụ cabin
- `GET /api/v1/admin/cabin-services` - Lấy tất cả dịch vụ cabin
- `GET /api/v1/admin/cabin-services/:id` - Lấy dịch vụ cabin theo ID
- `PUT /api/v1/admin/cabin-services/:id` - Cập nhật dịch vụ cabin
- `DELETE /api/v1/admin/cabin-services/:id` - Xóa dịch vụ cabin

#### Fare Class Management (REVENUE_ANALYST)
- `POST /api/v1/admin/fare-classes` - Tạo hạng vé (Requires ADMIN, REVENUE_ANALYST)
- `GET /api/v1/admin/fare-classes` - Lấy tất cả hạng vé
- `PUT /api/v1/admin/fare-classes/:code` - Cập nhật hạng vé
- `DELETE /api/v1/admin/fare-classes/:code` - Xóa hạng vé

#### Flight Schedule Management (SCHEDULE_PLANNER)
- `POST /api/v1/admin/flight-schedules` - Tạo lịch chuyến bay (Requires ADMIN, SCHEDULE_PLANNER)
- `GET /api/v1/admin/flight-schedules` - Lấy tất cả lịch chuyến bay
- `PUT /api/v1/admin/flight-schedules/:id` - Cập nhật lịch chuyến bay
- `DELETE /api/v1/admin/flight-schedules/:id` - Xóa lịch chuyến bay

#### Flight Instance Management (SCHEDULE_PLANNER)
- `POST /api/v1/admin/flight-instances` - Tạo chuyến bay thực tế
- `GET /api/v1/admin/flight-instances` - Lấy tất cả chuyến bay
- `PUT /api/v1/admin/flight-instances/:id` - Cập nhật chuyến bay
- `DELETE /api/v1/admin/flight-instances/:id` - Xóa chuyến bay

#### User Role Management (ADMIN)
- `POST /api/v1/admin/users/:userId/roles` - Gán quyền cho user (Requires ADMIN)
- `DELETE /api/v1/admin/users/:userId/roles/:roleCode` - Xóa quyền của user
- `GET /api/v1/admin/users/:userId/roles` - Lấy quyền của user
- `GET /api/v1/admin/roles` - Lấy tất cả roles

**Lưu ý**: Tất cả Admin APIs yêu cầu JWT authentication và role phù hợp. Xem [ROLES_AND_PERMISSIONS.md](./ROLES_AND_PERMISSIONS.md) để biết chi tiết về roles và permissions.

### Real-time WebSocket (Socket.IO)
- **Connection**: `ws://localhost:3000/realtime` với authentication (JWT token hoặc Session ID)
- **Events**:
  - `subscribe:seat-availability` - Subscribe to seat updates
  - `unsubscribe:seat-availability` - Unsubscribe from seat updates
  - `subscribe:reservation-countdown` - Subscribe to countdown timer
  - `unsubscribe:reservation-countdown` - Unsubscribe from countdown
  - `subscribe:payment-status` - Subscribe to payment updates
  - `unsubscribe:payment-status` - Unsubscribe from payment updates
- **Server Events**:
  - `connected` - Connection confirmed
  - `seat-availability:update` - Seat availability changed
  - `reservation-countdown:update` - Countdown updated (every second)
  - `reservation-countdown:expired` - Reservation expired
  - `payment-status:update` - Payment status changed
  - `error` - Error occurred
- **Xem chi tiết**: [Real-time Implementation Guide](./REALTIME_IMPLEMENTATION.md)

## Tính năng tự động

### Email thông báo
- Email xác nhận ticket tự động sau khi thanh toán thành công (với chi tiết đầy đủ: seat, cabin class, flight details, check-in time)
- Email xác nhận thanh toán tự động khi thanh toán thành công/thất bại
- Email gửi ngầm, không làm chậm quá trình xử lý
- **Lưu ý**: Không gửi email booking confirmation nữa - chỉ gửi ticket confirmation sau khi thanh toán thành công

### OTP (Mã xác thực)
- OTP thanh toán: Hết hạn sau 15 phút
- OTP đặt lại mật khẩu: Hết hạn sau 10 phút
- Mã OTP chỉ dùng được một lần, tự động xóa sau khi xác thực

### Giữ chỗ tự động
- Reservation tự động hết hạn sau 15 phút
- Tự động hủy nếu không tạo booking

### Real-time Updates (WebSocket)
- **Seat Availability**: Real-time updates khi seat được reserve/release
- **Reservation Countdown**: Server-synced countdown timer (mỗi giây)
- **Payment Status**: Real-time updates khi payment status thay đổi
- Backend-managed state - BE quản lý state, FE chỉ hiển thị

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

## Guest Booking (Đặt vé không cần đăng nhập)

Hệ thống hỗ trợ **Guest Booking** - cho phép người dùng chưa đăng nhập có thể đặt chuyến bay.

### Guest Booking Flow

1. **Tìm kiếm chuyến bay** (Public - không cần đăng nhập)
2. **Chọn cabin & seat** (Hiện tại vẫn cần đăng nhập - có thể mở rộng trong tương lai)
3. **Tạo reservation** (Không cần đăng nhập - Optional auth)
4. **Tạo booking** (Không cần đăng nhập - Optional auth)
   - **Contact information BẮT BUỘC** (fullname, email, phone)
   - **Passenger information BẮT BUỘC** (không thể dùng `passengerId`)
5. **Thanh toán** (Không cần đăng nhập - Optional auth)

### Authenticated Booking Flow

1. **Tìm kiếm chuyến bay** (Public)
2. **Chọn cabin & seat** (Cần đăng nhập)
3. **Tạo reservation** (Optional auth - nhưng có userId)
4. **Tạo booking** (Optional auth - nhưng có userId)
   - **Contact information OPTIONAL** (sẽ dùng user info nếu không có)
   - Có thể dùng `passengerId` để tái sử dụng passenger đã lưu
5. **Thanh toán** (Optional auth)

### Lưu ý

- **Guest bookings**: Booking và passengers được tạo với `user_id = null`
- **Authenticated bookings**: Booking và passengers được liên kết với user account
- **Email notifications**: Được gửi đến `contact_email` trong booking (không phải user email cho guest bookings)

## Lưu ý cho người dùng

1. **Chỉ gọi API qua API Gateway** (cổng 3000)
2. **Xem tài liệu API** tại `http://localhost:3000/api-docs`
3. **Tìm kiếm chuyến bay**:
   - Không cần truyền loại chuyến (một chiều/khứ hồi)
   - Hệ thống tự động nhận biết: Có ngày về → khứ hồi, không có → một chiều
4. **Guest Booking**: Người dùng chưa đăng nhập có thể đặt chuyến bay, nhưng phải cung cấp đầy đủ contact information
5. **Email thông báo** được gửi tự động, không cần làm gì thêm
6. **Mã OTP** được gửi qua email, kiểm tra hộp thư để lấy mã

## Cấu trúc thư mục

```
src/
├── api-gateway/          # Cổng API (cổng 3000)
│   └── modules/
│       └── realtime/     # WebSocket Gateway cho real-time updates
├── microservices/        # Các dịch vụ
│   ├── search/           # Dịch vụ tìm kiếm
│   ├── booking/          # Dịch vụ đặt chỗ
│   ├── reservation/      # Dịch vụ giữ chỗ
│   ├── payment/          # Dịch vụ thanh toán
│   └── email/            # Dịch vụ email
└── shared/               # Code dùng chung
```
