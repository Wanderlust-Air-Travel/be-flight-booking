import { IsNotEmpty, IsString, IsEnum, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethodCode } from 'src/shared/constants/enums';

export class CreatePaymentDto {
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

	@ApiPropertyOptional({
		description: 'Idempotency key to prevent duplicate payments (optional)',
		example: 'idempotency-key-12345',
	})
	@IsOptional()
	@IsString()
	idempotencyKey?: string;

	@ApiPropertyOptional({
		description: 'Payment amount (optional, defaults to booking total amount)',
		example: 1577000,
	})
	@IsOptional()
	@IsNumber()
	@Min(0.01, { message: 'Amount must be greater than 0' })
	amount?: number;
}

