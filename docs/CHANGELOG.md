# Changelog

Lịch sử các thay đổi quan trọng của dự án.

## [Unreleased]

### Tính năng mới

- **Auto-fetch từ Booking State (2025-11-25)**
  - **OptionalJwtAuthGuard**: Guard mới cho phép optional authentication - extract user từ JWT token nếu có, nhưng không bắt buộc authentication
  - **Auto-fetch Logic**: Một số API tự động lấy thông tin từ booking state khi user đã đăng nhập:
    - `GET /api/v1/search/fare-options`: Tự động lấy `flightInstanceId` và `cabinType` từ booking state
    - `GET /api/v1/search/seats`: Tự động lấy `cabinType` từ booking state
  - **Benefits**: Cải thiện UX, giảm số lượng API calls, backward compatible
  - **Implementation**:
    - `OptionalJwtAuthGuard` extract user từ JWT token nhưng không block request nếu không có token
    - `BookingStateRepository.findAllByUserId()` sử dụng raw Redis client để query keys (fix ioredis keyPrefix issue)
    - Query parameters luôn có priority cao hơn booking state (override)
  - **Files Changed**:
    - `src/api-gateway/modules/auth/guard/optional-jwt-auth.guard.ts` (new)
    - `src/api-gateway/modules/search/search.controller.ts` (updated)
    - `src/shared/repositories/booking-state.repository.ts` (updated)
    - `src/api-gateway/modules/auth/auth.module.ts` (updated)
    - `src/api-gateway/modules/search/search.client.module.ts` (updated)

### Cải tiến

- **Validation logic cho Booking State (2025-11-25)**
  - Thêm validation `fareClassCode` phải match với `cabinType`:
    - Economy: `fareClassCode` phải bắt đầu bằng 'Y' (ví dụ: 'YS', 'YF', 'YSM')
    - Business: `fareClassCode` phải bắt đầu bằng 'J' (ví dụ: 'JS', 'JF', 'JFLX')
  - Exception mới: `InvalidFareClassException` khi validation fail
  - Đảm bảo data integrity trước khi lưu vào Redis

- **Cải thiện Docker initialization flow (2025-11-25)**
  - Tách `wait-for-sqlserver.ts` và `wait-for-database.ts` để tránh race condition
  - Flow mới: `wait-for-sqlserver` → `init-db` → `wait-for-db` → `seed-db` → `start:all`
  - Thêm verification step sau migrations để đảm bảo database sẵn sàng
  - Tăng delay trước khi start services (10 giây) để đảm bảo database hoàn toàn sẵn sàng
  - Fix lỗi "Login failed" do database chưa tồn tại khi services kết nối

- **Code organization improvements (2025-11-25)**
  - Tách interfaces ra file riêng (`docker/start-all.types.ts`)
  - Tuân thủ separation of concerns: types tách khỏi logic code

### Tính năng mới

- **Email thông báo tự động (2025-11-23)**
  - Gửi email xác nhận thanh toán thành công/thất bại tự động
  - Gửi email xác nhận đặt chỗ sau khi tạo booking
  - Email được gửi ngầm, không làm chậm quá trình xử lý

- **Mã OTP cho xác thực (2025-11-23)**
  - Gửi mã OTP qua email cho thanh toán (hết hạn sau 15 phút)
  - Gửi mã OTP qua email cho đặt lại mật khẩu (hết hạn sau 10 phút)
  - Mã OTP chỉ dùng được một lần, tự động xóa sau khi xác thực thành công
  - Bảo mật: Không tiết lộ email có tồn tại hay không khi quên mật khẩu
  - **API mới**:
    - `POST /api/v1/auth/otp/payment/send` - Gửi OTP thanh toán
    - `POST /api/v1/auth/otp/payment/verify` - Xác thực OTP thanh toán
    - `POST /api/v1/auth/otp/password-reset/send` - Gửi OTP đặt lại mật khẩu
    - `POST /api/v1/auth/otp/password-reset/verify` - Xác thực OTP và đặt lại mật khẩu

- **Tải ảnh tự động cho deals (2025-11-22)**
  - Script tự động tải ảnh phong cảnh cho các deals
  - Chạy lệnh: `npm run download:deals-images`

### Thay đổi

- **Tìm kiếm chuyến bay đơn giản hơn (2025-11-21)**
  - Không cần truyền `tripType` nữa, hệ thống tự động nhận biết:
    - Có ngày về → Tự động là khứ hồi
    - Không có ngày về → Tự động là một chiều

- **Chọn ghế ngồi (2025-01-XX)**
  - Có thể chọn ghế khi đặt chỗ
  - Xem bản đồ ghế trước khi đặt vé
  - Ghế được giữ tự động khi tạo reservation

- **Chuẩn hóa cấu hình máy bay 2025-11-21)**
  - Tất cả máy bay đều có 180 ghế
  - Dễ dàng quản lý và tính toán

### Sửa lỗi

- **Xử lý lỗi tốt hơn (2025-11-20)**
  - Phân biệt rõ lỗi kỹ thuật (503) và lỗi dữ liệu (400/404)
  - Thông báo lỗi rõ ràng hơn cho người dùng

- **Sửa tên loại vé (2025-11-20)**
  - Hiển thị đúng tên loại vé: Standard thay vì Smart
  - Economy có 4 loại: Saver Max, Standard, Smart, Flex
  - Business có 3 loại: Standard, Smart, Flex

---

## [Previous Versions]

*Các version trước không có changelog chi tiết*
