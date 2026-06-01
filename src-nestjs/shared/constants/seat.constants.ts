/**
 * Seat Configuration Constants
 * 
 * Định nghĩa cố định các quy tắc tạo tên ghế ngồi trong business logic.
 * File seed và các service khác phải tuân theo constants này.
 */

/**
 * Các cột ghế tiêu chuẩn (6 cột: A, B, C, D, E, F)
 * Format: Window (A, F) | Middle (B, E) | Aisle (C, D)
 */
export const SEAT_COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

/**
 * Mapping cột ghế sang loại ghế (Seat Type)
 */
export const SEAT_TYPE_MAP: Record<string, 'Window' | 'Middle' | 'Aisle'> = {
	'A': 'Window',
	'B': 'Middle',
	'C': 'Aisle',
	'D': 'Aisle',
	'E': 'Middle',
	'F': 'Window',
};

/**
 * Hàm tạo tên ghế từ số hàng và cột
 * @param row - Số hàng (1, 2, 3, ...)
 * @param column - Cột ghế ('A', 'B', 'C', 'D', 'E', 'F')
 * @returns Tên ghế (ví dụ: '1A', '2B', '10F')
 */
export function generateSeatNumber(row: number, column: string): string {
	return `${row}${column}`;
}

/**
 * Hàm lấy loại ghế từ cột
 * @param column - Cột ghế ('A', 'B', 'C', 'D', 'E', 'F')
 * @returns Loại ghế ('Window', 'Middle', 'Aisle')
 */
export function getSeatType(column: string): 'Window' | 'Middle' | 'Aisle' {
	return SEAT_TYPE_MAP[column] || 'Aisle';
}

/**
 * Hàm kiểm tra cột ghế có phải cửa sổ không
 * @param column - Cột ghế
 * @returns true nếu là ghế cửa sổ (A hoặc F)
 */
export function isWindowSeat(column: string): boolean {
	return column === 'A' || column === 'F';
}

/**
 * Hàm kiểm tra cột ghế có phải giữa không
 * @param column - Cột ghế
 * @returns true nếu là ghế giữa (B hoặc E)
 */
export function isMiddleSeat(column: string): boolean {
	return column === 'B' || column === 'E';
}

/**
 * Hàm kiểm tra cột ghế có phải lối đi không
 * @param column - Cột ghế
 * @returns true nếu là ghế lối đi (C hoặc D)
 */
export function isAisleSeat(column: string): boolean {
	return column === 'C' || column === 'D';
}

/**
 * Cấu hình phân bổ ghế theo cabin class
 */
export const SEAT_DISTRIBUTION = {
	/**
	 * Tỷ lệ ghế Business (10% tổng số ghế)
	 */
	BUSINESS_PERCENTAGE: 0.1,
	
	/**
	 * Số cột ghế mỗi hàng (6 cột)
	 */
	COLUMNS_PER_ROW: SEAT_COLUMNS.length,
} as const;

