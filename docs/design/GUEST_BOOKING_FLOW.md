# Guest Booking Flow - Design Document

## Tổng quan

Hệ thống hỗ trợ **Guest Booking** - cho phép người dùng chưa đăng nhập có thể đặt chuyến bay mà không cần tạo tài khoản.

## Kiến trúc

### Optional Authentication

Hệ thống sử dụng `OptionalJwtAuthGuard` để cho phép các API endpoints hoạt động với hoặc không có JWT token:

```typescript
@UseGuards(OptionalJwtAuthGuard)
@Post()
async createBooking(@Req() req: Request & { user?: { userId: string } }) {
  const userId = req.user?.userId || null; // null cho guest bookings
  // ...
}
```

### Database Schema

**Booking Entity:**
- `user_id`: `nullable` - `null` cho guest bookings, `UUID` cho authenticated bookings

**Passenger Entity:**
- `user_id`: `nullable` - `null` cho guest bookings, `UUID` cho authenticated bookings

## Flow

### Guest Booking Flow

1. **Search Flights** (Public - không cần auth)
   - `GET /api/v1/search/flights`

2. **Select Cabin & Seat** (Cần đăng nhập - hiện tại)
   - `POST /api/v1/booking-state/cabin` - **Requires auth**
   - `POST /api/v1/booking-state/seat` - **Requires auth**
   - **Note**: Trong tương lai có thể mở rộng để hỗ trợ guest booking state

3. **Create Reservation** (Optional auth)
   - `POST /api/v1/reservations` - **Optional auth**
   - Nếu không có token: `userId = null` trong reservation
   - Reservation vẫn được lưu vào Redis với TTL 15 phút

4. **Create Booking** (Optional auth)
   - `POST /api/v1/bookings?reservationId=xxx` - **Optional auth**
   - **Contact information BẮT BUỘC** cho guest bookings
   - **Passenger information BẮT BUỘC** (không thể dùng `passengerId`)
   - Booking được tạo với `user_id = null`
   - Passengers được tạo với `user_id = null`

5. **Payment** (Optional auth)
   - `POST /api/v1/payments/bookings/:bookingId/process` - **Optional auth**
   - Payment được xử lý bình thường
   - Sau khi thanh toán thành công, tickets được tạo và email confirmation được gửi

### Authenticated Booking Flow

1. **Search Flights** (Public)
2. **Select Cabin & Seat** (Requires auth)
3. **Create Reservation** (Optional auth - nhưng có userId)
4. **Create Booking** (Optional auth - nhưng có userId)
   - Contact information **OPTIONAL** (sẽ dùng user info nếu không có)
   - Có thể dùng `passengerId` để tái sử dụng passenger đã lưu
5. **Payment** (Optional auth)

## Validation Rules

### Guest Bookings

- ✅ Contact information (fullname, email, phone) là **BẮT BUỘC**
- ✅ Passenger information phải được cung cấp đầy đủ (không thể dùng `passengerId`)
- ✅ Booking được tạo với `user_id = null`
- ✅ Passengers được tạo với `user_id = null`
- ❌ Không thể tái sử dụng passenger đã lưu (vì không có user account)

### Authenticated Bookings

- ✅ Contact information là **OPTIONAL** (sẽ dùng user info nếu không có)
- ✅ Có thể dùng `passengerId` để tái sử dụng passenger đã lưu
- ✅ Booking được liên kết với user account (`user_id`)
- ✅ Passengers được liên kết với user account (`user_id`)

## API Endpoints

### Optional Authentication Endpoints

- `POST /api/v1/reservations` - Guest bookings được hỗ trợ
- `POST /api/v1/bookings` - Guest bookings được hỗ trợ
- `GET /api/v1/bookings/:id/fare-details` - Public endpoint
- `GET /api/v1/bookings/:id/payment-info` - Public endpoint
- `GET /api/v1/search/fare-options` - Auto-fetch từ booking state nếu authenticated
- `GET /api/v1/search/seats` - Auto-fetch từ booking state nếu authenticated

### Required Authentication Endpoints

- `GET /api/v1/bookings/my-tickets` - Cần đăng nhập
- `GET /api/v1/bookings/my-journey` - Cần đăng nhập
- `POST /api/v1/booking-state/cabin` - Cần đăng nhập
- `POST /api/v1/booking-state/seat` - Cần đăng nhập

## Email Notifications

### Ticket Confirmation Email

Sau khi thanh toán thành công, hệ thống tự động:
1. Tạo tickets từ booking
2. Gửi email confirmation với chi tiết đầy đủ:
   - Ticket number
   - Passenger name
   - Flight details (origin, destination, departure/arrival times)
   - Seat number
   - Cabin class
   - Fare class
   - Recommended check-in time

**Lưu ý**: Không gửi email booking confirmation nữa - chỉ gửi ticket confirmation sau khi thanh toán thành công.

## Best Practices

1. **Contact Information**: Luôn validate contact info cho guest bookings
2. **Passenger Reuse**: Chỉ cho phép reuse passenger cho authenticated users
3. **State Management**: Booking state (cabin/seat) hiện tại vẫn cần authentication - có thể mở rộng trong tương lai
4. **Email Delivery**: Email được gửi đến `contact_email` trong booking (không phải user email cho guest bookings)

## Future Enhancements

1. **Guest Booking State**: Hỗ trợ lưu booking state (cabin/seat) cho guest users (có thể dùng session-based hoặc temporary token)
2. **Guest Account Linking**: Cho phép guest users liên kết booking với account sau khi đăng ký
3. **Guest Booking Lookup**: Cho phép guest users tra cứu booking bằng PNR code và email

