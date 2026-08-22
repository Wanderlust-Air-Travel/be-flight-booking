import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateCabinClassDto {
    @ApiProperty({
        description: 'Cabin class code (e.g., Y for Economy, J for Business, F for First)',
        example: 'Y',
        maxLength: 5,
        minLength: 1,
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(1)
    @MaxLength(5)
    @Matches(/^[A-Za-z]+$/, {
        message: 'cabinClassCode must contain letters only',
    })
    @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase().trim() : value))
    cabinClassCode: string;

    @ApiProperty({
        description: 'Cabin class display name',
        example: 'Economy',
        maxLength: 50,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    name: string;
}
