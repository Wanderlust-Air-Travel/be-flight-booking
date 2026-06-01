/**
 * Reservation Messages
 * 
 * Tất cả messages liên quan đến Reservation (Temporary seat holds)
 */

export const RESERVATION_MESSAGES = {
	SUCCESS: {
		CREATED: 'Giữ chỗ thành công',
		EXTENDED: 'Gia hạn giữ chỗ thành công',
		RELEASED: 'Giải phóng giữ chỗ thành công',
		RETRIEVED: 'Lấy thông tin giữ chỗ thành công',
	},
	ERROR: {
		NOT_FOUND: 'Không tìm thấy giữ chỗ',
		EXPIRED: 'Giữ chỗ đã hết hạn',
		ALREADY_EXPIRED: 'Giữ chỗ đã hết hạn',
		SEAT_ALREADY_RESERVED: 'Ghế đã được giữ bởi người khác',
		CANNOT_EXTEND: 'Không thể gia hạn giữ chỗ',
		INVALID_RESERVATION: 'Giữ chỗ không hợp lệ',
	},
	VALIDATION: {
		RESERVATION_ID_REQUIRED: 'Reservation ID là bắt buộc',
		RESERVATION_ID_INVALID_FORMAT: 'Định dạng Reservation ID không hợp lệ. Yêu cầu UUID v7.',
		RESERVATION_CODE_INVALID_FORMAT: 'Mã reservation phải là 6 ký tự chữ và số',
		FLIGHT_INSTANCE_ID_REQUIRED: 'Flight Instance ID là bắt buộc',
		SEAT_IDS_REQUIRED: 'Danh sách ghế là bắt buộc',
		SEAT_IDS_EMPTY: 'Danh sách ghế không được rỗng',
		SESSION_ID_REQUIRED_FOR_GUEST: 'Header X-Session-Id là bắt buộc cho người dùng khách. Vui lòng cung cấp session ID từ booking state response.',
		ADDITIONAL_SECONDS_REQUIRED: 'additionalSeconds là bắt buộc',
		ADDITIONAL_SECONDS_INVALID: 'additionalSeconds phải là số dương',
	},
} as const;

export type ReservationSuccessMessageKey = keyof typeof RESERVATION_MESSAGES.SUCCESS;
export type ReservationErrorMessageKey = keyof typeof RESERVATION_MESSAGES.ERROR;
export type ReservationValidationMessageKey = keyof typeof RESERVATION_MESSAGES.VALIDATION;

