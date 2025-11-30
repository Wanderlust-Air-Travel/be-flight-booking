import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsArray, ValidateNested, IsOptional, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { IsUUIDv7 } from 'src/shared/validators/is-uuid-v7.validator';
import { COMMON_MESSAGES, BOOKING_MESSAGES } from 'src/shared/constants/messages';

export class SeatSelectionItemDto {
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

export class SaveSeatSelectionDto {
	@ApiProperty({
		description: 'Flight instance ID',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@IsNotEmpty({ message: COMMON_MESSAGES.VALIDATION.ID_REQUIRED })
	@IsUUIDv7({ message: COMMON_MESSAGES.VALIDATION.ID_INVALID_UUID_V7 })
	flightInstanceId!: string;

	@ApiProperty({
		description: 'Single seat selection (deprecated: use seats array instead for multiple seats)',
		type: SeatSelectionItemDto,
		required: false,
		deprecated: true,
	})
	@IsOptional()
	@ValidateNested()
	@Type(() => SeatSelectionItemDto)
	seat?: SeatSelectionItemDto;

	@ApiProperty({
		description: 'Array of seat selections for multiple passengers (ADT + CHD, INF don\'t need seats)',
		type: [SeatSelectionItemDto],
		example: [
			{ flightSeatId: '019a8f4a-bb0e-7402-a0c4-27647b89dc72', seatNumber: '12A' },
			{ flightSeatId: '019a8f4a-bb0e-7402-a0c4-27647b89dc73', seatNumber: '12B' },
		],
		required: false,
	})
	@IsOptional()
	@IsArray({ message: BOOKING_MESSAGES.VALIDATION.SEAT_ID_REQUIRED })
	@ValidateNested({ each: true })
	@Type(() => SeatSelectionItemDto)
	@ArrayMinSize(1, { message: BOOKING_MESSAGES.VALIDATION.SEAT_ID_REQUIRED })
	seats?: SeatSelectionItemDto[];

	/**
	 * Custom validation: At least one of seats array, seat object, or legacy fields must be provided
	 * This is handled in controller logic, but we add a note here for clarity
	 */

	// Legacy fields for backward compatibility
	@ApiProperty({
		description: 'Flight seat ID (deprecated: use seat.flightSeatId or seats array)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc72',
		required: false,
		deprecated: true,
	})
	@IsOptional()
	@IsUUIDv7({ message: COMMON_MESSAGES.VALIDATION.ID_INVALID_UUID_V7 })
	flightSeatId?: string;

	@ApiProperty({
		description: 'Seat number (deprecated: use seat.seatNumber or seats array)',
		example: '12A',
		required: false,
		deprecated: true,
	})
	@IsOptional()
	@IsString({ message: BOOKING_MESSAGES.VALIDATION.SEAT_ID_REQUIRED })
	seatNumber?: string;
}

