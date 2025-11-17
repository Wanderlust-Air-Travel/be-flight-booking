import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsInt, Min, IsOptional } from 'class-validator';
import { IsUUIDv7 } from 'src/shared/validators/is-uuid-v7.validator';

export class CreateReservationDto {
	@ApiProperty({
		description: 'Flight instance ID (from GET /search/flights API)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@IsNotEmpty()
	@IsUUIDv7()
	flightInstanceId!: string;

	@ApiProperty({
		description: 'Fare class code (from GET /search/fare-options API)',
		example: 'YS',
	})
	@IsNotEmpty()
	@IsString()
	fareClassCode!: string;

	@ApiProperty({
		description: 'Number of passengers',
		example: 1,
		minimum: 1,
	})
	@IsNotEmpty()
	@IsInt()
	@Min(1)
	numberOfPassengers!: number;

	@ApiProperty({
		description: 'Currency code',
		example: 'VND',
		default: 'VND',
		required: false,
	})
	@IsOptional()
	@IsString()
	currencyCode?: string;
}

