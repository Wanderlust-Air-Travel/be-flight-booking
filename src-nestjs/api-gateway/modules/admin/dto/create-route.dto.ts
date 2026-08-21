import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateRouteDto {
    @ApiProperty({
        description: 'Origin airport ID (UUID)',
        example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
    })
    @IsUUID('7')
    @IsNotEmpty()
    originAirportId: string;

    @ApiProperty({
        description: 'Destination airport ID (UUID)',
        example: '019a8f4a-bb0e-7402-a0c4-27647b89dc72',
    })
    @IsUUID('7')
    @IsNotEmpty()
    destinationAirportId: string;

    @ApiProperty({
        description: 'Distance in kilometers (optional)',
        example: 1166,
        required: false,
        minimum: 0,
    })
    @IsInt()
    @IsOptional()
    @Min(0)
    distanceKm?: number;
}
