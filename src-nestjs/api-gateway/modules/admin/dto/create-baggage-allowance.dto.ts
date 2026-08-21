import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateBaggageAllowanceDto {
    @ApiProperty({
        description: 'Fare class code',
        example: 'YS',
        maxLength: 5,
    })
    @IsString()
    fareClassCode: string;

    @ApiProperty({
        description: 'Checked baggage allowance in kg. NULL means no checked baggage included',
        example: 20,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    checkedBaggageKg?: number | null;

    @ApiProperty({
        description:
            'Number of checked baggage pieces allowed. NULL means no checked baggage included',
        example: 1,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    checkedBaggagePieces?: number | null;

    @ApiProperty({
        description: 'Carry-on baggage allowance in kg',
        example: 7,
        required: false,
        default: 7,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    carryOnKg?: number;

    @ApiProperty({
        description: 'Number of carry-on pieces allowed',
        example: 1,
        required: false,
        default: 1,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    carryOnPieces?: number;

    @ApiProperty({
        description: 'Maximum dimensions for carry-on (length x width x height in cm)',
        example: '55x40x20',
        required: false,
    })
    @IsOptional()
    @IsString()
    carryOnDimensions?: string | null;

    @ApiProperty({
        description: 'Whether this allowance applies to domestic routes',
        example: true,
        required: false,
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    isDomestic?: boolean;

    @ApiProperty({
        description: 'Whether this allowance applies to international routes',
        example: true,
        required: false,
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    isInternational?: boolean;

    @ApiProperty({
        description: 'Additional notes or restrictions',
        example: 'Maximum weight per piece: 32kg',
        required: false,
    })
    @IsOptional()
    @IsString()
    notes?: string | null;
}
