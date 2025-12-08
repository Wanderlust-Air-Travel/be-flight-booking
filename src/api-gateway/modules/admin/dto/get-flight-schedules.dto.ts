import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class GetFlightSchedulesDto {
	@ApiProperty({
		description: 'Page number (1-based)',
		example: 1,
		required: false,
		default: 1,
		minimum: 1,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number = 1;

	@ApiProperty({
		description: 'Number of items per page. Allowed values: 20, 50, 100, 200',
		example: 20,
		required: false,
		default: 20,
		enum: [20, 50, 100, 200],
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@IsIn([20, 50, 100, 200], {
		message: 'limit must be one of: 20, 50, 100, 200',
	})
	limit?: number = 20;
}

