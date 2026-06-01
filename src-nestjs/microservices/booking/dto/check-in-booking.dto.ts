import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class SeatSelectionItemDto {
	@ApiProperty({
		description: 'Flight seat ID',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@IsString()
	@IsNotEmpty()
	flightSeatId: string;

	@ApiProperty({
		description: 'Seat number',
		example: 'A1',
	})
	@IsString()
	@IsNotEmpty()
	seatNumber: string;
}

export class CheckInSegmentDto {
	@ApiProperty({
		description: 'Flight instance ID',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@IsString()
	@IsNotEmpty()
	flightInstanceId: string;

	@ApiProperty({
		description: 'Seat selections for this segment (one per passenger, excluding infants)',
		type: [SeatSelectionItemDto],
	})
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => SeatSelectionItemDto)
	seats: SeatSelectionItemDto[];
}

export class CheckInBookingDto {
	@ApiProperty({
		description: 'PNR code or booking ID',
		example: 'ABC123',
	})
	@IsString()
	@IsNotEmpty()
	bookingCode: string;

	@ApiProperty({
		description: 'Seat selections for each segment',
		type: [CheckInSegmentDto],
	})
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CheckInSegmentDto)
	segments: CheckInSegmentDto[];
}

