import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsBoolean, Min, MaxLength } from 'class-validator';

export class UpdateCabinServiceDto {
	@ApiProperty({
		description: 'Service name/description',
		example: 'Hot Meal',
		maxLength: 200,
		required: false,
	})
	@IsOptional()
	@IsString()
	@MaxLength(200)
	serviceName?: string;

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
	})
	@IsOptional()
	@IsBoolean()
	isActive?: boolean;

	@ApiProperty({
		description: 'Display order for UI',
		example: 1,
		required: false,
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

