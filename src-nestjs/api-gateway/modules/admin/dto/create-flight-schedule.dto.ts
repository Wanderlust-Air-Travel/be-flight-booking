import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, IsUUID, Length, Matches } from 'class-validator';

export class CreateFlightScheduleDto {
    @ApiProperty({
        description: 'Flight number (e.g., QH101)',
        example: 'QH101',
        maxLength: 10,
    })
    @IsString()
    @IsNotEmpty()
    @Length(1, 10)
    flightNumber: string;

    @ApiProperty({
        description: 'Route ID (UUID v7)',
        example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
    })
    @IsUUID('7')
    @IsNotEmpty()
    routeId: string;

    @ApiProperty({
        description: 'Aircraft type ID (UUID v7)',
        example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
    })
    @IsUUID('7')
    @IsNotEmpty()
    aircraftTypeId: string;

    @ApiProperty({
        description: 'Departure time (HH:mm format)',
        example: '08:00',
    })
    @IsString()
    @IsNotEmpty()
    @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
        message: 'departureTime must be in HH:mm format',
    })
    departureTime: string;

    @ApiProperty({
        description: 'Arrival time (HH:mm format)',
        example: '10:30',
    })
    @IsString()
    @IsNotEmpty()
    @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
        message: 'arrivalTime must be in HH:mm format',
    })
    arrivalTime: string;

    @ApiProperty({
        description: 'Operating days (7 characters: 0=Sunday, 1=Monday, etc. Format: 1111111)',
        example: '1111111',
    })
    @IsString()
    @IsNotEmpty()
    @Length(7, 7)
    @Matches(/^[01]{7}$/, {
        message: 'operatingDays must be 7 characters of 0 or 1',
    })
    operatingDays: string;

    @ApiProperty({
        description: 'Effective from date (YYYY-MM-DD)',
        example: '2025-01-01',
    })
    @IsDateString()
    @IsNotEmpty()
    effectiveFrom: string;

    @ApiProperty({
        description: 'Effective to date (YYYY-MM-DD)',
        example: '2025-12-31',
    })
    @IsDateString()
    @IsNotEmpty()
    effectiveTo: string;

    @ApiProperty({
        description: 'Schedule status',
        example: 'active',
        enum: ['active', 'inactive', 'suspended'],
        required: false,
    })
    @IsString()
    @IsNotEmpty()
    status?: string;
}
