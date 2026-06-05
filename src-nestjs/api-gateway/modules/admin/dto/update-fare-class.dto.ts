import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateFareClassDto {
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
