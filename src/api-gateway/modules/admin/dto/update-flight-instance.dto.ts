import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsDateString } from 'class-validator';

export class UpdateFlightInstanceDto {
	@ApiProperty({
		description: 'Aircraft ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
		required: false,
	})
	@IsUUID('7')
	@IsOptional()
	aircraftId?: string;

	@ApiProperty({
		description: 'Departure datetime (ISO 8601 format)',
		example: '2025-01-15T08:00:00',
		required: false,
	})
	@IsDateString()
	@IsOptional()
	departureDateTime?: string;

	@ApiProperty({
		description: 'Arrival datetime (ISO 8601 format)',
		example: '2025-01-15T10:30:00',
		required: false,
	})
	@IsDateString()
	@IsOptional()
	arrivalDateTime?: string;

	@ApiProperty({
		description: 'Flight status',
		example: 'on_time',
		enum: ['scheduled', 'on_time', 'delayed', 'cancelled', 'departed', 'landed'],
		required: false,
	})
	@IsString()
	@IsOptional()
	status?: string;
}

