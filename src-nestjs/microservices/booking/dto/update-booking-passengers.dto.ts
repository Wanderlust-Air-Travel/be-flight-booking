import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, Min } from 'class-validator';

export class UpdateBookingPassengersDto {
    @ApiProperty({
        description: 'Number of adult passengers',
        example: 1,
        minimum: 1,
    })
    @IsNotEmpty()
    @IsInt()
    @Min(1)
    adults!: number;

    @ApiProperty({
        description: 'Number of minor passengers',
        example: 0,
        minimum: 0,
    })
    @IsNotEmpty()
    @IsInt()
    @Min(0)
    minors!: number;
}
