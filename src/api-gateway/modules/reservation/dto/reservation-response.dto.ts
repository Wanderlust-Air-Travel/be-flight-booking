import { ApiProperty } from '@nestjs/swagger';

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
		description: 'Number of passengers',
		example: 1,
	})
	numberOfPassengers!: number;

	@ApiProperty({
		description: 'Base fare amount',
		example: 1577000,
	})
	baseFare!: number;

	@ApiProperty({
		description: 'Tax amount',
		example: 0,
	})
	taxAmount!: number;

	@ApiProperty({
		description: 'Fee amount',
		example: 0,
	})
	feeAmount!: number;

	@ApiProperty({
		description: 'Total amount',
		example: 1577000,
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
}

