import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Matches, MaxLength, Min } from 'class-validator';

export class CreateAircraftTypeDto {
    @ApiProperty({
        description: 'Aircraft type code (unique identifier)',
        example: 'A320neo',
        maxLength: 20,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(20)
    @Matches(/^[A-Za-z0-9-]+$/, {
        message: 'Code must contain only letters, numbers, and hyphens',
    })
    code: string;

    @ApiProperty({
        description: 'Aircraft manufacturer name',
        example: 'Airbus',
        maxLength: 100,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    manufacturer: string;

    @ApiProperty({
        description: 'Aircraft model name',
        example: 'A320neo',
        maxLength: 100,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    model: string;

    @ApiProperty({
        description: 'Total number of seats',
        example: 186,
        minimum: 1,
    })
    @IsInt()
    @IsNotEmpty()
    @Min(1)
    totalSeats: number;
}
