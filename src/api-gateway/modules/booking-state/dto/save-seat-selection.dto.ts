import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsUUIDv7 } from 'src/shared/validators/is-uuid-v7.validator';
import { COMMON_MESSAGES, BOOKING_MESSAGES } from 'src/shared/constants/messages';

export class SaveSeatSelectionDto {
	@ApiProperty({
		description: 'Flight instance ID',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@IsNotEmpty({ message: COMMON_MESSAGES.VALIDATION.ID_REQUIRED })
	@IsUUIDv7({ message: COMMON_MESSAGES.VALIDATION.ID_INVALID_UUID_V7 })
	flightInstanceId!: string;

	@ApiProperty({
		description: 'Flight seat ID (from search/seats API)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc72',
	})
	@IsNotEmpty({ message: BOOKING_MESSAGES.VALIDATION.SEAT_ID_REQUIRED })
	@IsUUIDv7({ message: COMMON_MESSAGES.VALIDATION.ID_INVALID_UUID_V7 })
	flightSeatId!: string;

	@ApiProperty({
		description: 'Seat number (e.g., "12A")',
		example: '12A',
	})
	@IsNotEmpty({ message: BOOKING_MESSAGES.VALIDATION.SEAT_ID_REQUIRED })
	@IsString({ message: BOOKING_MESSAGES.VALIDATION.SEAT_ID_REQUIRED })
	seatNumber!: string;
}

