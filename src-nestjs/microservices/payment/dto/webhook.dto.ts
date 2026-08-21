import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class PaymentWebhookDto {
    @ApiProperty({
        description: 'Transaction ID from payment gateway',
        example: 'TXN123456789',
    })
    @IsNotEmpty()
    @IsString()
    transactionId: string;

    @ApiProperty({
        description: 'Payment status',
        enum: ['success', 'failed'],
        example: 'success',
    })
    @IsNotEmpty()
    @IsEnum(['success', 'failed'])
    status: 'success' | 'failed';

    @ApiPropertyOptional({
        description: 'Payment amount',
        example: 1577000,
    })
    @IsOptional()
    @IsNumber()
    amount?: number;

    @ApiPropertyOptional({
        description: 'Currency code',
        example: 'VND',
    })
    @IsOptional()
    @IsString()
    currency?: string;

    @ApiPropertyOptional({
        description: 'Additional message from gateway',
        example: 'Payment processed successfully',
    })
    @IsOptional()
    @IsString()
    message?: string;

    @ApiPropertyOptional({
        description: 'Additional gateway-specific data',
    })
    @IsOptional()
    gatewayData?: any;
}
