/**
 * Authentication Messages
 *
 * Tất cả messages liên quan đến Authentication (Register, Login, OTP, etc.)
 * Phân loại theo: Success, Error, Validation
 */

export const AUTH_MESSAGES = {
    SUCCESS: {
        REGISTER: 'Đăng ký tài khoản thành công',
        LOGIN: 'Đăng nhập thành công',
        LOGOUT: 'Đăng xuất thành công',
        REFRESH_TOKEN: 'Làm mới token thành công',
        OTP_SENT: 'OTP đã được gửi thành công',
        OTP_VERIFIED: 'Xác thực OTP thành công',
        PASSWORD_RESET: 'Đặt lại mật khẩu thành công',
        OTP_PAYMENT_SENT: 'OTP thanh toán đã được gửi thành công',
        OTP_PAYMENT_VERIFIED: 'Xác thực OTP thanh toán thành công',
        OTP_CANCELLATION_SENT: 'OTP hủy vé đã được gửi thành công',
        OTP_CANCELLATION_VERIFIED: 'Xác thực OTP hủy vé thành công',
        PASSWORD_RESET_OTP_SENT: 'Nếu email tồn tại, OTP đã được gửi đến email của bạn',
    },
    ERROR: {
        EMAIL_ALREADY_EXISTS: 'Email đã được đăng ký',
        INVALID_CREDENTIALS: 'Email hoặc mật khẩu không chính xác',
        USER_NOT_FOUND: 'Không tìm thấy người dùng',
        INVALID_OR_EXPIRED_OTP: 'OTP không hợp lệ hoặc đã hết hạn',
        INVALID_REFRESH_TOKEN: 'Refresh token không hợp lệ',
        UNAUTHORIZED: 'Bạn không có quyền truy cập',
        TOKEN_EXPIRED: 'Token đã hết hạn',
        OTP_VERIFICATION_FAILED: 'Xác thực OTP thất bại',
        PASSWORD_RESET_FAILED: 'Đặt lại mật khẩu thất bại',
        EMAIL_SERVICE_UNAVAILABLE: 'Dịch vụ email hiện không khả dụng. Vui lòng thử lại sau',
        EMAIL_SERVICE_CONNECTION_CLOSED:
            'Kết nối dịch vụ email bị đóng. Vui lòng đảm bảo dịch vụ đang chạy',
        EMAIL_SERVICE_TIMEOUT:
            'Dịch vụ email không phản hồi. Dịch vụ có thể không khả dụng hoặc quá tải',
        FAILED_TO_SEND_OTP_EMAIL: 'Gửi email OTP thất bại. Vui lòng thử lại',
    },
    VALIDATION: {
        EMAIL_REQUIRED: 'Email là bắt buộc',
        EMAIL_INVALID: 'Email không hợp lệ',
        PASSWORD_REQUIRED: 'Mật khẩu là bắt buộc',
        PASSWORD_TOO_WEAK:
            'Mật khẩu quá yếu. Vui lòng sử dụng ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt',
        FULLNAME_REQUIRED: 'Họ tên là bắt buộc',
        PHONE_REQUIRED: 'Số điện thoại là bắt buộc',
        PHONE_INVALID: 'Số điện thoại không hợp lệ',
        OTP_REQUIRED: 'OTP là bắt buộc',
        OTP_INVALID_FORMAT: 'OTP phải là 6 chữ số',
        USER_ID_REQUIRED: 'User ID là bắt buộc',
        REFRESH_TOKEN_REQUIRED: 'Refresh token là bắt buộc',
        NEW_PASSWORD_REQUIRED: 'Mật khẩu mới là bắt buộc',
        BOOKING_ID_REQUIRED: 'Booking ID là bắt buộc (cho OTP hủy vé)',
    },
} as const;

/**
 * Type-safe message keys for TypeScript autocomplete
 */
export type AuthSuccessMessageKey = keyof typeof AUTH_MESSAGES.SUCCESS;
export type AuthErrorMessageKey = keyof typeof AUTH_MESSAGES.ERROR;
export type AuthValidationMessageKey = keyof typeof AUTH_MESSAGES.VALIDATION;
