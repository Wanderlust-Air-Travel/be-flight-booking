/**
 * Search Messages
 *
 * Tất cả messages liên quan đến Search Flights
 */

export const SEARCH_MESSAGES = {
    SUCCESS: {
        FLIGHTS_FOUND: 'Tìm thấy chuyến bay',
        FARE_OPTIONS_RETRIEVED: 'Lấy thông tin hạng vé thành công',
        SEAT_MAP_RETRIEVED: 'Lấy sơ đồ ghế thành công',
    },
    ERROR: {
        ORIGIN_NOT_FOUND: 'Không tìm thấy sân bay đi',
        DESTINATION_NOT_FOUND: 'Không tìm thấy sân bay đến',
        ROUTE_NOT_FOUND: 'Không tìm thấy tuyến bay',
        NO_FLIGHTS_FOUND: 'Không tìm thấy chuyến bay phù hợp',
        INVALID_DATE_RANGE: 'Khoảng thời gian không hợp lệ',
        PAST_DATE_NOT_ALLOWED: 'Không thể tìm kiếm chuyến bay trong quá khứ',
        SEAT_MAP_NOT_FOUND: 'Không tìm thấy sơ đồ ghế',
        FARE_OPTIONS_NOT_FOUND: 'Không tìm thấy hạng vé',
    },
    VALIDATION: {
        ORIGIN_REQUIRED: 'Sân bay đi là bắt buộc',
        ORIGIN_INVALID: 'Mã sân bay đi không hợp lệ (phải là 3 ký tự)',
        DESTINATION_REQUIRED: 'Sân bay đến là bắt buộc',
        DESTINATION_INVALID: 'Mã sân bay đến không hợp lệ (phải là 3 ký tự)',
        DEPART_DATE_REQUIRED: 'Ngày đi là bắt buộc',
        DEPART_DATE_INVALID: 'Ngày đi không hợp lệ',
        RETURN_DATE_REQUIRED: 'Ngày về là bắt buộc (cho chuyến khứ hồi)',
        RETURN_DATE_INVALID: 'Ngày về không hợp lệ',
        RETURN_DATE_BEFORE_DEPART: 'Ngày về phải sau ngày đi',
        TRIP_TYPE_REQUIRED: 'Loại chuyến bay là bắt buộc',
        TRIP_TYPE_INVALID: 'Loại chuyến bay không hợp lệ',
        ADULTS_REQUIRED: 'Số lượng người lớn là bắt buộc',
        ADULTS_MIN: 'Số lượng người lớn phải ít nhất là 1',
        MINORS_INVALID: 'Số lượng trẻ em không hợp lệ',
        FLIGHT_INSTANCE_ID_REQUIRED: 'Flight Instance ID là bắt buộc',
    },
} as const;

export type SearchSuccessMessageKey = keyof typeof SEARCH_MESSAGES.SUCCESS;
export type SearchErrorMessageKey = keyof typeof SEARCH_MESSAGES.ERROR;
export type SearchValidationMessageKey = keyof typeof SEARCH_MESSAGES.VALIDATION;
