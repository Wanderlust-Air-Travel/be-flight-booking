import { IsNotEmpty, IsEnum, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PaymentStatus {
	PENDING = 'pending',
	SUCCESS = 'success',
	FAILED = 'failed',
}

export class UpdatePaymentStatusDto {
	@ApiProperty({
		description: 'Payment ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@IsNotEmpty()
	@IsUUID('7', { message: 'paymentId must be a valid UUID v7' })
	@Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
		message: 'paymentId must be a valid UUID v7',
	})
	paymentId: string;

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

