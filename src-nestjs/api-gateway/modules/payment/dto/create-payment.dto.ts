import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaymentMethodCode } from 'src/shared/constants/enums';
import { PAYMENT_MESSAGES } from 'src/shared/constants/messages';

export class CreatePaymentDto {
    @ApiProperty({
        description: 'Payment method code',
        enum: PaymentMethodCode,
        example: PaymentMethodCode.CREDIT_CARD,
    })
    @IsNotEmpty({ message: PAYMENT_MESSAGES.VALIDATION.PAYMENT_METHOD_REQUIRED })
    @IsEnum(PaymentMethodCode, {
        message: PAYMENT_MESSAGES.ERROR.INVALID_PAYMENT_METHOD,
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
    @IsNumber({}, { message: PAYMENT_MESSAGES.VALIDATION.AMOUNT_INVALID })
    @Min(0.01, { message: PAYMENT_MESSAGES.VALIDATION.AMOUNT_INVALID })
    amount?: number;
}
