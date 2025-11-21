import { ApiProperty } from '@nestjs/swagger';

export class ReservationSegmentDto {
	@ApiProperty({
		description: 'Segment ID',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	segmentId!: string;

	@ApiProperty({
		description: 'Flight instance ID',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	flightInstanceId!: string;

	@ApiProperty({
		description: 'Fare class code',
		example: 'YS',
	})
	fareClassCode!: string;

	@ApiProperty({
		description: 'Segment type: outbound or inbound',
		enum: ['outbound', 'inbound'],
		example: 'outbound',
	})
	segmentType!: 'outbound' | 'inbound';

	@ApiProperty({
		description: 'Base fare amount for this segment',
		example: 1577000,
	})
	baseFare!: number;

	@ApiProperty({
		description: 'Tax amount for this segment',
		example: 0,
	})
	taxAmount!: number;

	@ApiProperty({
		description: 'Fee amount for this segment',
		example: 0,
	})
	feeAmount!: number;

	@ApiProperty({
		description: 'Flight seat ID (if seat was selected)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc72',
		required: false,
	})
	flightSeatId?: string | null;

	@ApiProperty({
		description: 'Seat number (if seat was selected)',
		example: 'A1',
		required: false,
	})
	seatNumber?: string | null;
}

export class ReservationResponseDto {
	@ApiProperty({
		description: 'Reservation ID',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	reservationId!: string;

	@ApiProperty({
		description: 'Reservation code (6 alphanumeric characters)',
		example: 'ABC123',
	})
	reservationCode!: string;

	@ApiProperty({
		description: 'List of reservation segments (supports multi-segment for round-trip)',
		type: [ReservationSegmentDto],
	})
	segments!: ReservationSegmentDto[];

	@ApiProperty({
		description: 'Number of passengers',
		example: 1,
	})
	numberOfPassengers!: number;

	@ApiProperty({
		description: 'Total amount (sum of all segments)',
		example: 3154000,
	})
	totalAmount!: number;

	@ApiProperty({
		description: 'Currency code',
		example: 'VND',
	})
	currencyCode!: string;

	@ApiProperty({
		description: 'Reservation status',
		example: 'active',
		enum: ['active', 'expired', 'converted', 'cancelled'],
	})
	status!: string;

	@ApiProperty({
		description: 'Expiration timestamp',
		example: '2025-01-20T10:30:00Z',
	})
	expiresAt!: Date;

	@ApiProperty({
		description: 'Time to live in seconds',
		example: 900,
	})
	ttl!: number;

	@ApiProperty({
		description: 'Created timestamp',
		example: '2025-01-20T10:15:00Z',
	})
	createdAt!: Date;

	@ApiProperty({
		description: 'User ID who created the reservation (for ownership validation)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
		required: false,
	})
	userId?: string | null;
}

