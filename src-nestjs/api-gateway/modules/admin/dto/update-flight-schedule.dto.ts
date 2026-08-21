import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateFlightScheduleDto {
    @ApiProperty({
        description: 'Departure time (HH:mm format)',
        example: '08:00',
        required: false,
    })
    @IsString()
    @IsOptional()
    @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
        message: 'departureTime must be in HH:mm format',
    })
    departureTime?: string;

    @ApiProperty({
        description: 'Arrival time (HH:mm format)',
        example: '10:30',
        required: false,
    })
    @IsString()
    @IsOptional()
    @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
        message: 'arrivalTime must be in HH:mm format',
    })
    arrivalTime?: string;

    @ApiProperty({
        description: 'Operating days (7 characters: 0=Sunday, 1=Monday, etc. Format: 1111111)',
        example: '1111111',
        required: false,
    })
    @IsString()
    @IsOptional()
    @Length(7, 7)
    @Matches(/^[01]{7}$/, {
        message: 'operatingDays must be 7 characters of 0 or 1',
    })
    operatingDays?: string;

    @ApiProperty({
        description: 'Effective from date (YYYY-MM-DD)',
        example: '2025-01-01',
        required: false,
    })
    @IsDateString()
    @IsOptional()
    effectiveFrom?: string;

    @ApiProperty({
        description: 'Effective to date (YYYY-MM-DD)',
        example: '2025-12-31',
        required: false,
    })
    @IsDateString()
    @IsOptional()
    effectiveTo?: string;

    @ApiProperty({
        description: 'Schedule status',
        example: 'active',
        enum: ['active', 'inactive', 'suspended'],
        required: false,
    })
    @IsString()
    @IsOptional()
    status?: string;
}
