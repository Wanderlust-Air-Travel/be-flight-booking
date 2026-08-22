import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateDealDto {
    @ApiProperty({
        description: 'Deal title',
        example: 'Hà Nội ↔ Đà Nẵng — Giảm 20%',
        maxLength: 500,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    title: string;

    @ApiProperty({
        description: 'Deal description',
        example: 'Khuyến mãi đặc biệt cho chuyến bay một chiều Hà Nội – Đà Nẵng.',
        required: false,
        maxLength: 1000,
    })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;

    @ApiProperty({
        description: 'Start date of the deal',
        example: '2026-08-01T00:00:00Z',
    })
    @IsDateString()
    validFrom: string;

    @ApiProperty({
        description: 'End date of the deal',
        example: '2026-12-31T23:59:59Z',
    })
    @IsDateString()
    validUntil: string;

    @ApiProperty({
        description: 'Discount percentage',
        example: 20,
        minimum: 1,
        maximum: 100,
    })
    @IsNumber()
    @Min(1)
    @Max(100)
    discountPct: number;

    @ApiProperty({
        description: 'List of destination airport codes',
        example: ['HAN', 'DAD'],
        required: false,
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @Transform(({ value }) => {
        if (Array.isArray(value)) {
            return JSON.stringify(value);
        }
        return value;
    })
    destinations?: string[];

    @ApiProperty({
        description: 'Whether the deal is active',
        example: true,
        required: false,
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
