import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsInt, Min, IsOptional, IsArray, ValidateNested, IsEnum, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { IsUUIDv7 } from 'src/shared/validators/is-uuid-v7.validator';

export class CreateReservationSegmentDto {
	@ApiProperty({
		description: 'Flight instance ID (from search/flights API). Backend will automatically fetch cabin and seat selection from Redis.',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@IsNotEmpty()
	@IsUUIDv7()
	flightInstanceId!: string;

	@ApiProperty({
		description: 'Segment type: outbound or inbound (for round-trip bookings)',
		enum: ['outbound', 'inbound'],
		example: 'outbound',
	})
	@IsNotEmpty()
	@IsEnum(['outbound', 'inbound'])
	segmentType!: 'outbound' | 'inbound';
}

export class CreateReservationDto {
	@ApiProperty({
		description: 'List of flight segments (for round-trip, include both outbound and inbound)',
		type: [CreateReservationSegmentDto],
		example: [
			{
				flightInstanceId: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
				fareClassCode: 'YS',
				segmentType: 'outbound',
			},
			{
				flightInstanceId: '019a8f4a-bb0e-7402-a0c4-27647b89dc72',
				fareClassCode: 'YS',
				segmentType: 'inbound',
			},
		],
	})
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateReservationSegmentDto)
	@ArrayMinSize(1, { message: 'At least one segment is required' })
	segments!: CreateReservationSegmentDto[];

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

