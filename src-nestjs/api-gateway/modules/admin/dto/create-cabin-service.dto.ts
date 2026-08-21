import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateCabinServiceDto {
    @ApiProperty({
        description: 'Cabin class code (nullable if service is fare-class specific)',
        example: 'Y',
        maxLength: 5,
        required: false,
    })
    @IsOptional()
    @IsString()
    @MaxLength(5)
    cabinClassCode?: string | null;

    @ApiProperty({
        description: 'Fare class code (nullable if service is cabin-class specific)',
        example: 'YS',
        maxLength: 5,
        required: false,
    })
    @IsOptional()
    @IsString()
    @MaxLength(5)
    fareClassCode?: string | null;

    @ApiProperty({
        description:
            'Service type/category (e.g., meal, entertainment, wifi, priority_boarding, lounge_access)',
        example: 'meal',
        maxLength: 50,
    })
    @IsString()
    @MaxLength(50)
    serviceType: string;

    @ApiProperty({
        description: 'Service name/description',
        example: 'Hot Meal',
        maxLength: 200,
    })
    @IsString()
    @MaxLength(200)
    serviceName: string;

    @ApiProperty({
        description: 'Detailed description of the service',
        example: 'Hot meal and beverage served during flight',
        maxLength: 1000,
        required: false,
    })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string | null;

    @ApiProperty({
        description: 'Whether this service is included (true) or available for purchase (false)',
        example: true,
        required: false,
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    isIncluded?: boolean;

    @ApiProperty({
        description: 'Price if service is not included (in VND). NULL if service is included',
        example: 200000,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    price?: number | null;

    @ApiProperty({
        description: 'Whether this service is currently available',
        example: true,
        required: false,
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiProperty({
        description: 'Display order for UI',
        example: 1,
        required: false,
        default: 0,
    })
    @IsOptional()
    @IsNumber()
    displayOrder?: number;

    @ApiProperty({
        description: 'Icon or image URL for the service',
        example: 'https://example.com/icons/meal.png',
        maxLength: 500,
        required: false,
    })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    iconUrl?: string | null;
}
