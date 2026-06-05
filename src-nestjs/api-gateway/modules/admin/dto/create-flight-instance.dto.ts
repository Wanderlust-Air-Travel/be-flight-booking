import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateFlightInstanceDto {
    @ApiProperty({
        description: 'Flight schedule ID (UUID v7)',
        example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
    })
    @IsUUID('7')
    @IsNotEmpty()
    flightScheduleId: string;

    @ApiProperty({
        description: 'Flight date (YYYY-MM-DD)',
        example: '2025-01-15',
    })
    @IsDateString()
    @IsNotEmpty()
    flightDate: string;

    @ApiProperty({
        description: 'Aircraft ID (UUID v7) - Optional, will be auto-assigned if not provided',
        example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
        required: false,
    })
    @IsUUID('7')
    @IsOptional()
    aircraftId?: string;

    @ApiProperty({
        description: 'Flight status',
        example: 'scheduled',
        enum: ['scheduled', 'on_time', 'delayed', 'cancelled'],
        required: false,
    })
    @IsString()
    @IsOptional()
    status?: string;
}
