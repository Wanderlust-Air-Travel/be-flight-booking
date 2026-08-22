import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreatePromotionDto {
    @ApiProperty({
        description: 'Promotion code (unique)',
        example: 'WELCOME10',
        maxLength: 50,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    code: string;

    @ApiProperty({
        description: 'Promotion description',
        example: 'Giảm 10% cho lần đặt vé đầu tiên.',
        required: false,
        maxLength: 1000,
    })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;

    @ApiProperty({
        description: 'End date of the promotion',
        example: '2026-12-31T23:59:59Z',
    })
    @IsDateString()
    validUntil: string;

    @ApiProperty({
        description: 'Minimum purchase amount to apply the promotion',
        example: 1000000,
        minimum: 0,
    })
    @IsNumber()
    @Min(0)
    minPurchaseAmount: number;

    @ApiProperty({
        description: 'Currency code',
        example: 'VND',
        required: false,
        maxLength: 3,
        default: 'VND',
    })
    @IsOptional()
    @IsString()
    @MaxLength(3)
    currency?: string;

    @ApiProperty({
        description: 'Discount percentage',
        example: 10,
        minimum: 1,
        maximum: 100,
    })
    @IsNumber()
    @Min(1)
    @Max(100)
    discountPct: number;

    @ApiProperty({
        description: 'Whether the promotion is active',
        example: true,
        required: false,
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
