import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFareClassDto {
    @ApiProperty({
        description: 'Fare class code (e.g., YS, YF, JS, JF)',
        example: 'YS',
        maxLength: 5,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(5)
    fareClassCode: string;

    @ApiProperty({
        description: 'Cabin class code (Y for Economy, J for Business)',
        example: 'Y',
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(5)
    cabinClassCode: string;

    @ApiProperty({
        description: 'Fare class description',
        example: 'Economy Smart',
        required: false,
    })
    @IsString()
    @IsOptional()
    @MaxLength(200)
    description?: string;

    @ApiProperty({
        description: 'Change rule description',
        example: 'Change before departure: 450,000 VND',
        required: false,
    })
    @IsString()
    @IsOptional()
    @MaxLength(500)
    changeRule?: string;

    @ApiProperty({
        description: 'Refund rule description',
        example: 'Refund before departure: 450,000 VND',
        required: false,
    })
    @IsString()
    @IsOptional()
    @MaxLength(500)
    refundRule?: string;
}
