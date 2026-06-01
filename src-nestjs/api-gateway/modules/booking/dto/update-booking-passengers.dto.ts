import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsInt, Min } from 'class-validator';
import { BOOKING_MESSAGES } from 'src/shared/constants/messages';

export class UpdateBookingPassengersDto {
	@ApiProperty({
		description: 'Number of adult passengers',
		example: 1,
		minimum: 1,
	})
	@IsNotEmpty({ message: BOOKING_MESSAGES.VALIDATION.INVALID_PASSENGER_COUNT })
	@IsInt({ message: BOOKING_MESSAGES.VALIDATION.INVALID_PASSENGER_COUNT })
	@Min(1, { message: BOOKING_MESSAGES.VALIDATION.INVALID_PASSENGER_COUNT })
	adults!: number;

	@ApiProperty({
		description: 'Number of minor passengers',
		example: 0,
		minimum: 0,
	})
	@IsNotEmpty({ message: BOOKING_MESSAGES.VALIDATION.INVALID_PASSENGER_COUNT })
	@IsInt({ message: BOOKING_MESSAGES.VALIDATION.INVALID_PASSENGER_COUNT })
	@Min(0, { message: BOOKING_MESSAGES.VALIDATION.INVALID_PASSENGER_COUNT })
	minors!: number;
}

