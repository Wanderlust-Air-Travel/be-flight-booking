import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateAircraftTypeDto {
    @ApiProperty({
        description: 'Aircraft manufacturer name',
        example: 'Airbus',
        maxLength: 100,
        required: false,
    })
    @IsString()
    @IsOptional()
    @MaxLength(100)
    manufacturer?: string;

    @ApiProperty({
        description: 'Aircraft model name',
        example: 'A320neo',
        maxLength: 100,
        required: false,
    })
    @IsString()
    @IsOptional()
    @MaxLength(100)
    model?: string;

    @ApiProperty({
        description: 'Total number of seats',
        example: 186,
        minimum: 1,
        required: false,
    })
    @IsInt()
    @IsOptional()
    @Min(1)
    totalSeats?: number;
}
