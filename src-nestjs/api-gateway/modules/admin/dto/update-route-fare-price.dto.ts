import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateRouteFarePriceDto {
    @ApiProperty({
        description: 'Base price in VND',
        example: 1577000,
        minimum: 0,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    basePrice?: number;

    @ApiProperty({
        description: 'Tax rate (as decimal, e.g., 0.1 for 10%)',
        example: 0.1,
        minimum: 0,
        maximum: 1,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1)
    taxRate?: number;

    @ApiProperty({
        description: 'Fee rate (as decimal, e.g., 0.05 for 5%)',
        example: 0.05,
        minimum: 0,
        maximum: 1,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1)
    feeRate?: number;

    @ApiProperty({
        description: 'Effective from date (YYYY-MM-DD)',
        example: '2025-01-01',
        required: false,
    })
    @IsOptional()
    @IsDateString()
    effectiveFrom?: string;

    @ApiProperty({
        description: 'Effective to date (YYYY-MM-DD). NULL means valid indefinitely',
        example: '2025-12-31',
        required: false,
    })
    @IsOptional()
    @IsDateString()
    effectiveTo?: string | null;

    @ApiProperty({
        description: 'Whether this price is active',
        example: true,
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiProperty({
        description: 'Priority (higher priority prices take precedence)',
        example: 0,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    priority?: number;

    @ApiProperty({
        description: 'Notes or description for this price',
        example: 'Promotional price for summer season',
        required: false,
    })
    @IsOptional()
    @IsString()
    notes?: string | null;
}
