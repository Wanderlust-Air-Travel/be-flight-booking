import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsBoolean, IsInt, IsOptional, MaxLength, Min } from 'class-validator';

export class CreateFareDescriptionRuleDto {
	@ApiProperty({
		description: 'Fare class code pattern (exact match like "Y", "J" or contains pattern like "SMX", "FLX", "SM", "FLEX")',
		example: 'SMX',
		maxLength: 50,
	})
	@IsString()
	@IsNotEmpty()
	@MaxLength(50)
	fareClassCodePattern!: string;

	@ApiProperty({
		description: 'Cabin type (economy or business)',
		example: 'economy',
		enum: ['economy', 'business'],
	})
	@IsString()
	@IsNotEmpty()
	cabinType!: string;

	@ApiProperty({
		description: 'Description text',
		example: 'Hành lý xách tay: 7kg',
		maxLength: 500,
	})
	@IsString()
	@IsNotEmpty()
	@MaxLength(500)
	descriptionText!: string;

	@ApiProperty({
		description: 'Status (true = included/available, false = not included/not available)',
		example: true,
		default: true,
	})
	@IsBoolean()
	@IsOptional()
	status?: boolean;

	@ApiProperty({
		description: 'Display order (0 = first)',
		example: 0,
		default: 0,
	})
	@IsInt()
	@Min(0)
	@IsOptional()
	displayOrder?: number;

	@ApiProperty({
		description: 'Is active',
		example: true,
		default: true,
	})
	@IsBoolean()
	@IsOptional()
	isActive?: boolean;

	@ApiProperty({
		description: 'Is default rule (like "Hành lý xách tay: 7kg" that applies to all)',
		example: false,
		default: false,
	})
	@IsBoolean()
	@IsOptional()
	isDefault?: boolean;
}

