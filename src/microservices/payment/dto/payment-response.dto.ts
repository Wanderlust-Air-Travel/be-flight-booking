import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaymentResponseDto {
	@ApiProperty({
		description: 'Payment ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	paymentId: string;

	@ApiProperty({
		description: 'Booking ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	bookingId: string;

	@ApiProperty({
		description: 'PNR Code',
		example: 'ABC123',
	})
	pnrCode: string;

	@ApiProperty({
		description: 'Payment amount',
		example: 1577000,
	})
	amount: number;

	@ApiProperty({
		description: 'Currency code',
		example: 'VND',
	})
	currencyCode: string;

	@ApiProperty({
		description: 'Payment method code',
		example: 'CREDIT_CARD',
	})
	paymentMethodCode: string;

	@ApiProperty({
		description: 'Payment method name',
		example: 'Credit Card',
	})
	paymentMethodName: string;

	@ApiProperty({
		description: 'Payment status',
		enum: ['pending', 'success', 'failed'],
		example: 'pending',
	})
	status: 'pending' | 'success' | 'failed';

	@ApiProperty({
		description: 'Transaction reference from payment gateway',
		example: 'TXN123456789',
		nullable: true,
	})
	transactionRef: string | null;

	@ApiProperty({
		description: 'Payment created at',
		example: '2025-01-20T10:15:00Z',
	})
	createdAt: Date;

	@ApiProperty({
		description: 'Payment paid at',
		example: '2025-01-20T10:20:00Z',
		nullable: true,
	})
	paidAt: Date | null;

	@ApiProperty({
		description: 'Payment expiration date',
		example: '2025-01-20T10:30:00Z',
		nullable: true,
	})
	expiresAt: Date | null;

	@ApiPropertyOptional({
		description: 'Payment URL for redirecting to payment gateway',
		example: 'https://payment-gateway.com/pay/xxx',
		nullable: true,
	})
	paymentUrl?: string | null;
}

