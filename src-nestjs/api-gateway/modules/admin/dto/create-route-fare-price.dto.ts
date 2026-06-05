import { ApiProperty } from '@nestjs/swagger';
import {
    IsBoolean,
    IsDateString,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    Min,
} from 'class-validator';

export class CreateRouteFarePriceDto {
    @ApiProperty({
        description: 'Route ID (UUID v7)',
        example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
    })
    @IsUUID()
    routeId: string;

    @ApiProperty({
        description: 'Fare class code',
        example: 'YS',
        maxLength: 5,
    })
    @IsString()
    fareClassCode: string;

    @ApiProperty({
        description: 'Base price in VND',
        example: 1577000,
        minimum: 0,
    })
    @IsNumber()
    @Min(0)
    basePrice: number;

    @ApiProperty({
        description: 'Tax rate (as decimal, e.g., 0.1 for 10%)',
        example: 0.1,
        minimum: 0,
        maximum: 1,
        required: false,
        default: 0.1,
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
        default: 0.05,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1)
    feeRate?: number;

    @ApiProperty({
        description: 'Effective from date (YYYY-MM-DD)',
        example: '2025-01-01',
    })
    @IsDateString()
    effectiveFrom: string;

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
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiProperty({
        description: 'Priority (higher priority prices take precedence)',
        example: 0,
        required: false,
        default: 0,
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
