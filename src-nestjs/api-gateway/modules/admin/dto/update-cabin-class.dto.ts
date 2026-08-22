import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateCabinClassDto {
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
