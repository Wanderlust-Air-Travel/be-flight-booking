import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class UpdateAirportDto {
    @ApiProperty({
        description: 'ICAO airport code (4 uppercase letters)',
        example: 'VVTS',
        maxLength: 4,
        minLength: 4,
        required: false,
    })
    @IsString()
    @IsOptional()
    @Length(4, 4)
    @Matches(/^[A-Z]{4}$/, {
        message: 'ICAO code must be exactly 4 uppercase letters',
    })
    icaoCode?: string;

    @ApiProperty({
        description: 'Airport name',
        example: 'Tan Son Nhat International Airport',
        maxLength: 150,
        required: false,
    })
    @IsString()
    @IsOptional()
    @MaxLength(150)
    name?: string;

    @ApiProperty({
        description: 'City name',
        example: 'Ho Chi Minh City',
        maxLength: 100,
        required: false,
    })
    @IsString()
    @IsOptional()
    @MaxLength(100)
    city?: string;

    @ApiProperty({
        description: 'Country name',
        example: 'Vietnam',
        maxLength: 100,
        required: false,
    })
    @IsString()
    @IsOptional()
    @MaxLength(100)
    country?: string;

    @ApiProperty({
        description: 'IANA timezone identifier',
        example: 'Asia/Ho_Chi_Minh',
        maxLength: 50,
        required: false,
    })
    @IsString()
    @IsOptional()
    @MaxLength(50)
    timezone?: string;
}
