import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaymentStatus } from 'src/shared/constants/enums';
import { PAYMENT_MESSAGES } from 'src/shared/constants/messages';

export class UpdatePaymentStatusDto {
    @ApiProperty({
        description: 'New payment status',
        enum: PaymentStatus,
        example: PaymentStatus.SUCCESS,
    })
    @IsNotEmpty({ message: PAYMENT_MESSAGES.VALIDATION.PAYMENT_METHOD_REQUIRED })
    @IsEnum(PaymentStatus, {
        message: PAYMENT_MESSAGES.ERROR.INVALID_PAYMENT_METHOD,
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
