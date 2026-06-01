import { ApiProperty } from '@nestjs/swagger';

export class CreateBookingResponseDto {
	@ApiProperty({
		description: 'Booking ID',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	bookingId!: string;

	@ApiProperty({
		description: 'PNR code',
		example: 'ABC123',
	})
	pnrCode!: string;

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
		description: 'Booking status',
		example: 'pending',
	})
	status!: string;
}

