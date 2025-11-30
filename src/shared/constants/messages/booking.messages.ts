/**
 * Booking Messages
 * 
 * Tất cả messages liên quan đến Booking (Create, Cancel, Update, etc.)
 */

export const BOOKING_MESSAGES = {
	SUCCESS: {
		CREATED: 'Đặt vé thành công',
		CANCELLED: 'Hủy vé thành công',
		UPDATED: 'Cập nhật đặt vé thành công',
		RETRIEVED: 'Lấy thông tin đặt vé thành công',
		LIST_RETRIEVED: 'Lấy danh sách đặt vé thành công',
		SEAT_SELECTED: 'Chọn ghế thành công',
		SEAT_UPDATED: 'Cập nhật ghế thành công',
	},
	ERROR: {
		NOT_FOUND: 'Không tìm thấy đặt vé',
		ALREADY_CANCELLED: 'Đặt vé đã được hủy',
		CANNOT_CANCEL: 'Không thể hủy đặt vé này',
		CANCELLATION_EXPIRED: 'Thời gian hủy vé đã hết hạn',
		INVALID_STATUS: 'Trạng thái đặt vé không hợp lệ',
		SEAT_NOT_AVAILABLE: 'Ghế không còn trống',
		SEAT_ALREADY_BOOKED: 'Ghế đã được đặt',
		FLIGHT_NOT_FOUND: 'Không tìm thấy chuyến bay',
		INSUFFICIENT_SEATS: 'Không đủ ghế trống',
		PAYMENT_REQUIRED: 'Cần thanh toán để hoàn tất đặt vé',
		BOOKING_EXPIRED: 'Đặt vé đã hết hạn',
	},
	VALIDATION: {
		BOOKING_ID_REQUIRED: 'Booking ID là bắt buộc',
		BOOKING_ID_INVALID_FORMAT: 'Định dạng Booking ID không hợp lệ. Yêu cầu UUID v7.',
		FLIGHT_ID_REQUIRED: 'Flight ID là bắt buộc',
		PASSENGERS_REQUIRED: 'Thông tin hành khách là bắt buộc',
		PASSENGER_NAME_REQUIRED: 'Tên hành khách là bắt buộc',
		PASSENGER_EMAIL_REQUIRED: 'Email hành khách là bắt buộc',
		PASSENGER_PHONE_REQUIRED: 'Số điện thoại hành khách là bắt buộc',
		SEAT_ID_REQUIRED: 'Seat ID là bắt buộc',
		INVALID_PASSENGER_COUNT: 'Số lượng hành khách không hợp lệ',
		RESERVATION_ID_REQUIRED: 'Reservation ID là bắt buộc. Đặt vé phải được tạo từ reservation.',
		REQUEST_BODY_REQUIRED: 'Request body là bắt buộc khi tạo đặt vé từ reservation',
		CONTACT_INFO_REQUIRED_FOR_GUEST: 'Thông tin liên hệ (họ tên, email, số điện thoại) là bắt buộc cho đặt vé khách.',
		TICKET_ID_INVALID_FORMAT: 'Định dạng Ticket ID không hợp lệ. Yêu cầu UUID v7.',
		OTP_VERIFICATION_REQUIRED_PAID_BOOKING: 'Xác thực OTP là bắt buộc để hủy đặt vé đã thanh toán. Vui lòng xác thực OTP trước bằng POST /api/v1/auth/otp/cancellation/verify',
		OTP_VERIFICATION_REQUIRED_PAID_TICKET: 'Xác thực OTP là bắt buộc để hủy vé từ đặt vé đã thanh toán. Vui lòng xác thực OTP trước bằng POST /api/v1/auth/otp/cancellation/verify',
	},
} as const;

export type BookingSuccessMessageKey = keyof typeof BOOKING_MESSAGES.SUCCESS;
export type BookingErrorMessageKey = keyof typeof BOOKING_MESSAGES.ERROR;
export type BookingValidationMessageKey = keyof typeof BOOKING_MESSAGES.VALIDATION;

