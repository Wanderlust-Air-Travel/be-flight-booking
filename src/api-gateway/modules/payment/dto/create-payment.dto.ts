import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';
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

