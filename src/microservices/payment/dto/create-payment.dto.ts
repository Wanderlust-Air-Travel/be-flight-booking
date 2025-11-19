import { IsNotEmpty, IsString, IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PaymentMethodCode {
	CREDIT_CARD = 'CREDIT_CARD',
	DEBIT_CARD = 'DEBIT_CARD',
	BANK_TRANSFER = 'BANK_TRANSFER',
	EWALLET = 'EWALLET',
	CASH = 'CASH',
}

export class CreatePaymentDto {
	@ApiProperty({
		description: 'Booking ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@IsNotEmpty()
	@IsUUID('7', { message: 'bookingId must be a valid UUID v7' })
	@Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
		message: 'bookingId must be a valid UUID v7',
	})
	bookingId: string;

	@ApiProperty({
		description: 'Payment method code',
		enum: PaymentMethodCode,
		example: PaymentMethodCode.CREDIT_CARD,
	})
	@IsNotEmpty()
	@IsEnum(PaymentMethodCode, {
		message: 'paymentMethodCode must be one of: CREDIT_CARD, DEBIT_CARD, BANK_TRANSFER, EWALLET, CASH',
	})
	paymentMethodCode: PaymentMethodCode;

	@ApiPropertyOptional({
		description: 'Transaction reference from payment gateway (optional)',
		example: 'TXN123456789',
	})
	@IsOptional()
	@IsString()
	transactionRef?: string;
}

