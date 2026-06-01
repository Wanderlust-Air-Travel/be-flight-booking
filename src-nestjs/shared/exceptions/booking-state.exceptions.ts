import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base exception for booking state errors
 */
export class BookingStateException extends HttpException {
	constructor(message: string, statusCode: HttpStatus = HttpStatus.BAD_REQUEST) {
		super(message, statusCode);
		this.name = 'BookingStateException';
	}
}

/**
 * Thrown when cabin is not selected before seat selection
 */
export class CabinNotSelectedException extends BookingStateException {
	constructor(flightInstanceId?: string) {
		const message = flightInstanceId
			? `Cabin must be selected for flight ${flightInstanceId} before selecting a seat. Please select cabin first.`
			: 'Cabin must be selected before selecting a seat. Please select cabin first.';
		super(message, HttpStatus.BAD_REQUEST);
		this.name = 'CabinNotSelectedException';
	}
}

/**
 * Thrown when seat is not selected before creating reservation
 */
export class SeatNotSelectedException extends BookingStateException {
	constructor(flightInstanceId?: string) {
		const message = flightInstanceId
			? `Seat must be selected for flight ${flightInstanceId} before creating reservation. Please select seat after cabin selection.`
			: 'Seat must be selected before creating reservation. Please select seat after cabin selection.';
		super(message, HttpStatus.BAD_REQUEST);
		this.name = 'SeatNotSelectedException';
	}
}

/**
 * Thrown when booking state is not found in Redis
 */
export class BookingStateNotFoundException extends BookingStateException {
	constructor(flightInstanceId: string) {
		super(
			`No booking state found for flight ${flightInstanceId}. Please select cabin and seat first.`,
			HttpStatus.NOT_FOUND,
		);
		this.name = 'BookingStateNotFoundException';
	}
}

/**
 * Thrown when fare class code doesn't match cabin type
 */
export class InvalidFareClassException extends BookingStateException {
	constructor(fareClassCode: string, cabinType: string) {
		const message = `Fare class code '${fareClassCode}' does not match cabin type '${cabinType}'. Economy fare classes must start with 'Y', business fare classes must start with 'J'.`;
		super(message, HttpStatus.BAD_REQUEST);
		this.name = 'InvalidFareClassException';
	}
}

/**
 * Thrown when Redis operation fails
 */
export class BookingStateStorageException extends BookingStateException {
	constructor(operation: string, details?: string) {
		const message = details
			? `Failed to ${operation} booking state: ${details}`
			: `Failed to ${operation} booking state to Redis`;
		super(message, HttpStatus.INTERNAL_SERVER_ERROR);
		this.name = 'BookingStateStorageException';
	}
}

