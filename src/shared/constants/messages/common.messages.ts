/**
 * Common Messages
 * 
 * Messages chung cho toàn bộ hệ thống (không thuộc domain cụ thể)
 */

export const COMMON_MESSAGES = {
	SUCCESS: {
		OPERATION_SUCCESS: 'Thao tác thành công',
		DATA_RETRIEVED: 'Lấy dữ liệu thành công',
		DATA_UPDATED: 'Cập nhật dữ liệu thành công',
		DATA_DELETED: 'Xóa dữ liệu thành công',
	},
	ERROR: {
		INTERNAL_SERVER_ERROR: 'Lỗi máy chủ nội bộ',
		BAD_REQUEST: 'Yêu cầu không hợp lệ',
		UNAUTHORIZED: 'Không có quyền truy cập',
		FORBIDDEN: 'Bị cấm truy cập',
		NOT_FOUND: 'Không tìm thấy tài nguyên',
		CONFLICT: 'Xung đột dữ liệu',
		VALIDATION_FAILED: 'Xác thực dữ liệu thất bại',
		SERVICE_UNAVAILABLE: 'Dịch vụ không khả dụng',
		TIMEOUT: 'Yêu cầu hết thời gian chờ',
		RATE_LIMIT_EXCEEDED: 'Vượt quá giới hạn yêu cầu',
		MICROSERVICE_ERROR: 'Lỗi từ microservice',
		MICROSERVICE_UNAVAILABLE: 'Microservice không khả dụng',
		MICROSERVICE_TIMEOUT: 'Microservice không phản hồi',
		MICROSERVICE_CONNECTION_REFUSED: 'Microservice không chạy. Vui lòng khởi động dịch vụ.',
		MICROSERVICE_CONNECTION_CLOSED: 'Kết nối microservice bị đóng. Vui lòng đảm bảo dịch vụ đang chạy.',
		MICROSERVICE_REQUEST_TIMEOUT: 'Microservice không phản hồi. Dịch vụ có thể không khả dụng hoặc quá tải.',
		UNKNOWN_ERROR: 'Lỗi không xác định',
		OPERATION_FAILED: 'Thao tác thất bại',
	},
	VALIDATION: {
		ID_REQUIRED: 'ID là bắt buộc',
		ID_INVALID: 'ID không hợp lệ',
		ID_INVALID_UUID_V7: 'Định dạng ID không hợp lệ. Yêu cầu UUID v7.',
		PAGE_INVALID: 'Số trang không hợp lệ',
		LIMIT_INVALID: 'Giới hạn không hợp lệ',
		DATE_INVALID: 'Ngày tháng không hợp lệ',
		EMAIL_INVALID: 'Email không hợp lệ',
		PHONE_INVALID: 'Số điện thoại không hợp lệ',
	},
} as const;

export type CommonSuccessMessageKey = keyof typeof COMMON_MESSAGES.SUCCESS;
export type CommonErrorMessageKey = keyof typeof COMMON_MESSAGES.ERROR;
export type CommonValidationMessageKey = keyof typeof COMMON_MESSAGES.VALIDATION;

