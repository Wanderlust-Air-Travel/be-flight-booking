import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GetCabinServicesDto {
    @ApiProperty({
        description: 'Fare class code',
        example: 'YS',
    })
    @IsNotEmpty({ message: 'fareClassCode is required' })
    @IsString()
    fareClassCode: string;

    @ApiProperty({
        description: 'Cabin class code (Y for Economy, J for Business)',
        example: 'Y',
    })
    @IsNotEmpty({ message: 'cabinClassCode is required' })
    @IsString()
    cabinClassCode: string;
}
