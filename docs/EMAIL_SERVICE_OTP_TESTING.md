# Hướng dẫn kiểm tra Email và OTP

Hướng dẫn kiểm tra tính năng gửi email và mã OTP.

## Tổng quan

Hệ thống hỗ trợ gửi email tự động với các loại:

1. **OTP thanh toán** - Mã xác thực khi thanh toán (hết hạn sau 15 phút)
2. **OTP đặt lại mật khẩu** - Mã xác thực khi quên mật khẩu (hết hạn sau 10 phút)
3. **Email xác nhận thanh toán** - Tự động gửi khi thanh toán thành công/thất bại
4. **Email xác nhận đặt chỗ** - Tự động gửi sau khi đặt chỗ thành công

## Kiểm tra Email Service có hoạt động không

### Kiểm tra trạng thái

**Yêu cầu:**
```bash
GET http://localhost:3000/api/v1/emails/health
```

**Kết quả:**
```json
{
  "status": "ok",
  "gmailReady": true,
  "queueStats": {
    "total": 10,
    "queued": 2,
    "sent": 6,
    "failed": 0
  }
}
```

**Kiểm tra:**
- `status: "ok"` - Dịch vụ đang hoạt động
- `gmailReady: true` - Email sẵn sàng gửi

## API OTP

### 1. Gửi OTP thanh toán

**Yêu cầu:**
```bash
POST /api/v1/auth/otp/payment/send
Content-Type: application/json

{
  "userId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71"
}
```

**Kết quả:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "expiresIn": 900
}
```

**Lưu ý:**
- OTP được gửi đến email của user
- OTP hết hạn sau 15 phút (900 giây)
- Kiểm tra hộp thư để lấy mã OTP

### 2. Xác thực OTP thanh toán

**Yêu cầu:**
```bash
POST /api/v1/auth/otp/payment/verify
Content-Type: application/json

{
  "userId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "otp": "123456"
}
```

**Kết quả:**
```json
{
  "success": true,
  "message": "OTP verified successfully"
}
```

**Lỗi:**
- `401 Unauthorized` - OTP không đúng hoặc đã hết hạn

### 3. Gửi OTP đặt lại mật khẩu

**Yêu cầu:**
```bash
POST /api/v1/auth/otp/password-reset/send
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Kết quả:**
```json
{
  "success": true,
  "message": "If the email exists, an OTP has been sent",
  "expiresIn": 600
}
```

**Lưu ý:**
- Luôn trả về thành công để bảo mật (không tiết lộ email có tồn tại hay không)
- OTP hết hạn sau 10 phút (600 giây)
- Kiểm tra hộp thư để lấy mã OTP

### 4. Xác thực OTP và đặt lại mật khẩu

**Yêu cầu:**
```bash
POST /api/v1/auth/otp/password-reset/verify
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456",
  "newPassword": "NewStrongP@ssw0rd"
}
```

**Kết quả:**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

**Lưu ý:**
- Mật khẩu mới phải có ít nhất 6 ký tự
- Sau khi reset thành công, đăng nhập với mật khẩu mới
- OTP chỉ dùng được một lần

## Email tự động

### Email xác nhận đặt chỗ

Tự động gửi sau khi tạo booking thành công.

**Nội dung email:**
- Mã PNR (mã đặt chỗ)
- Thông tin chuyến bay
- Tổng tiền
- Thông tin liên hệ

### Email xác nhận thanh toán

Tự động gửi khi thanh toán thành công hoặc thất bại.

**Email thanh toán thành công:**
- Mã PNR
- Tổng tiền đã thanh toán
- Thông tin thanh toán

**Email thanh toán thất bại:**
- Thông báo lỗi
- Hướng dẫn thử lại

## Lưu ý quan trọng

1. **Email được gửi ngầm**
   - Không làm chậm quá trình xử lý
   - Có thể kiểm tra sau trong hộp thư

2. **Mã OTP chỉ dùng một lần**
   - Sau khi xác thực thành công, mã sẽ bị xóa
   - Nếu nhập sai, cần gửi lại mã mới

3. **Thời gian hết hạn**
   - OTP thanh toán: 15 phút
   - OTP đặt lại mật khẩu: 10 phút

4. **Bảo mật**
   - Không chia sẻ mã OTP với người khác
   - Kiểm tra email chính xác trước khi gửi OTP

## Xử lý lỗi

### Email Service không hoạt động

1. Kiểm tra dịch vụ email có chạy không
2. Kiểm tra cấu hình Gmail API
3. Xem logs để biết lỗi cụ thể

### OTP không đến

1. Kiểm tra hộp thư spam
2. Đảm bảo email đúng
3. Thử gửi lại OTP
4. Kiểm tra email service có hoạt động không (health check)

## Test bằng Postman

Có thể test các API OTP bằng file Postman collection trong thư mục `tools/`:
- `Flight-Booking-API.postman_collection.json`
