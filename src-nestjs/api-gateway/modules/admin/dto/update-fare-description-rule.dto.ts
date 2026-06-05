import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateFareDescriptionRuleDto {
    @ApiProperty({
        description: 'Fare class code pattern',
        example: 'SMX',
        maxLength: 50,
        required: false,
    })
    @IsString()
    @IsOptional()
    @MaxLength(50)
    fareClassCodePattern?: string;

    @ApiProperty({
        description: 'Cabin type (economy or business)',
        example: 'economy',
        enum: ['economy', 'business'],
        required: false,
    })
    @IsString()
    @IsOptional()
    cabinType?: string;

    @ApiProperty({
        description: 'Description text',
        example: 'Hành lý xách tay: 7kg',
        maxLength: 500,
        required: false,
    })
    @IsString()
    @IsOptional()
    @MaxLength(500)
    descriptionText?: string;

    @ApiProperty({
        description: 'Status (true = included/available, false = not included/not available)',
        example: true,
        required: false,
    })
    @IsBoolean()
    @IsOptional()
    status?: boolean;

    @ApiProperty({
        description: 'Display order (0 = first)',
        example: 0,
        required: false,
    })
    @IsInt()
    @Min(0)
    @IsOptional()
    displayOrder?: number;

    @ApiProperty({
        description: 'Is active',
        example: true,
        required: false,
    })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @ApiProperty({
        description: 'Is default rule',
        example: false,
        required: false,
    })
    @IsBoolean()
    @IsOptional()
    isDefault?: boolean;
}
