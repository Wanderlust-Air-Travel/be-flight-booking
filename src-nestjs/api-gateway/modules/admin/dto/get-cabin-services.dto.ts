import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn } from 'class-validator';

export class GetCabinServicesDto {
	@ApiProperty({
		description: 'Search query to filter by service name, type, description, cabin class, or fare class',
		example: 'meal',
		required: false,
	})
	@IsOptional()
	@IsString()
	search?: string;

	@ApiProperty({
		description: 'Filter by active status',
		example: 'all',
		enum: ['all', 'active', 'inactive'],
		required: false,
	})
	@IsOptional()
	@IsString()
	@IsIn(['all', 'active', 'inactive'], {
		message: 'filterActive must be one of: all, active, inactive',
	})
	filterActive?: 'all' | 'active' | 'inactive' = 'all';
}

