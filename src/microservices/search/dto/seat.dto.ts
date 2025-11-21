import { ApiProperty } from '@nestjs/swagger';

export class SeatDto {
	@ApiProperty({
		description: 'Flight seat ID (UUID v7) - use this for reservation',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	flightSeatId!: string;

	@ApiProperty({
		description: 'Seat number (e.g., A1, B2)',
		example: 'A1',
	})
	seatNumber!: string;

	@ApiProperty({
		description: 'Cabin class code',
		example: 'Y',
	})
	cabinClassCode!: string;

	@ApiProperty({
		description: 'Seat type (window, aisle, middle)',
		example: 'window',
		nullable: true,
	})
	seatType!: string | null;

	@ApiProperty({
		description: 'Whether this is an exit row seat',
		example: false,
	})
	isExitRow!: boolean;

	@ApiProperty({
		description: 'Seat position (left or right)',
		example: 'left',
		enum: ['left', 'right'],
	})
	position!: 'left' | 'right';

	@ApiProperty({
		description: 'Whether the seat is available',
		example: true,
	})
	isAvailable!: boolean;

	@ApiProperty({
		description: 'Fare class note code (e.g., bf for business-flex, ef for economy-flex)',
		example: 'bf',
		nullable: true,
	})
	note!: string | null;
}

