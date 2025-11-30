/**
 * Payment Messages
 * 
 * Tất cả messages liên quan đến Payment
 */

export const PAYMENT_MESSAGES = {
	SUCCESS: {
		CREATED: 'Tạo giao dịch thanh toán thành công',
		PROCESSED: 'Xử lý thanh toán thành công',
		COMPLETED: 'Thanh toán hoàn tất',
		REFUNDED: 'Hoàn tiền thành công',
		RETRIEVED: 'Lấy thông tin thanh toán thành công',
		STATUS_UPDATED: 'Cập nhật trạng thái thanh toán thành công',
		WEBHOOK_PROCESSED: 'Xử lý webhook thành công',
	},
	ERROR: {
		NOT_FOUND: 'Không tìm thấy giao dịch thanh toán',
		ALREADY_PAID: 'Giao dịch đã được thanh toán',
		PAYMENT_FAILED: 'Thanh toán thất bại',
		INSUFFICIENT_FUNDS: 'Số dư không đủ',
		INVALID_PAYMENT_METHOD: 'Phương thức thanh toán không hợp lệ',
		PAYMENT_EXPIRED: 'Giao dịch thanh toán đã hết hạn',
		REFUND_FAILED: 'Hoàn tiền thất bại',
		INVALID_AMOUNT: 'Số tiền không hợp lệ',
		PAYMENT_METHOD_NOT_AVAILABLE: 'Phương thức thanh toán không khả dụng',
		BOOKING_NOT_FOUND: 'Không tìm thấy đặt vé',
		MICROSERVICE_ERROR: 'Lỗi từ payment microservice',
	},
	VALIDATION: {
		PAYMENT_ID_REQUIRED: 'Payment ID là bắt buộc',
		PAYMENT_ID_INVALID_FORMAT: 'Định dạng Payment ID không hợp lệ. Yêu cầu UUID v7.',
		BOOKING_ID_REQUIRED: 'Booking ID là bắt buộc',
		BOOKING_ID_INVALID_FORMAT: 'Định dạng Booking ID không hợp lệ. Yêu cầu UUID v7.',
		AMOUNT_REQUIRED: 'Số tiền là bắt buộc',
		AMOUNT_INVALID: 'Số tiền phải lớn hơn 0',
		PAYMENT_METHOD_REQUIRED: 'Phương thức thanh toán là bắt buộc',
		CURRENCY_REQUIRED: 'Loại tiền tệ là bắt buộc',
		GATEWAY_INVALID: 'Gateway không hợp lệ',
	},
} as const;

export type PaymentSuccessMessageKey = keyof typeof PAYMENT_MESSAGES.SUCCESS;
export type PaymentErrorMessageKey = keyof typeof PAYMENT_MESSAGES.ERROR;
export type PaymentValidationMessageKey = keyof typeof PAYMENT_MESSAGES.VALIDATION;

