import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateRouteDto {
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
