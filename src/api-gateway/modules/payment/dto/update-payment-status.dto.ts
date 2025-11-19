import { IsNotEmpty, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PaymentStatus {
	PENDING = 'pending',
	SUCCESS = 'success',
	FAILED = 'failed',
}

export class UpdatePaymentStatusDto {
	@ApiProperty({
		description: 'New payment status',
		enum: PaymentStatus,
		example: PaymentStatus.SUCCESS,
	})
	@IsNotEmpty()
	@IsEnum(PaymentStatus, {
		message: 'status must be one of: pending, success, failed',
	})
	status: PaymentStatus;

	@ApiPropertyOptional({
		description: 'Transaction reference from payment gateway',
		example: 'TXN123456789',
	})
	@IsOptional()
	@IsString()
	transactionRef?: string;
}

