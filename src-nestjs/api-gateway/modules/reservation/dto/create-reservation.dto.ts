import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsInt, Min, IsOptional, IsArray, ValidateNested, IsEnum, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { IsUUIDv7 } from 'src/shared/validators/is-uuid-v7.validator';
import { RESERVATION_MESSAGES, COMMON_MESSAGES } from 'src/shared/constants/messages';

export class CreateReservationSegmentDto {
	@ApiProperty({
		description: 'Flight instance ID (from search/flights API). Backend will automatically fetch cabin and seat selection from Redis.',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@IsNotEmpty({ message: RESERVATION_MESSAGES.VALIDATION.FLIGHT_INSTANCE_ID_REQUIRED })
	@IsUUIDv7({ message: COMMON_MESSAGES.VALIDATION.ID_INVALID_UUID_V7 })
	flightInstanceId!: string;

	@ApiProperty({
		description: 'Segment type: outbound or inbound (for round-trip bookings)',
		enum: ['outbound', 'inbound'],
		example: 'outbound',
	})
	@IsNotEmpty({ message: RESERVATION_MESSAGES.VALIDATION.FLIGHT_INSTANCE_ID_REQUIRED })
	@IsEnum(['outbound', 'inbound'], { message: RESERVATION_MESSAGES.VALIDATION.FLIGHT_INSTANCE_ID_REQUIRED })
	segmentType!: 'outbound' | 'inbound';
}

export class CreateReservationDto {
	@ApiProperty({
		description: 'List of flight segments (for round-trip, include both outbound and inbound)',
		type: [CreateReservationSegmentDto],
		example: [
			{
				flightInstanceId: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
				segmentType: 'outbound',
			},
			{
				flightInstanceId: '019a8f4a-bb0e-7402-a0c4-27647b89dc72',
				segmentType: 'inbound',
			},
		],
	})
	@IsArray({ message: RESERVATION_MESSAGES.VALIDATION.SEAT_IDS_REQUIRED })
	@ValidateNested({ each: true })
	@Type(() => CreateReservationSegmentDto)
	@ArrayMinSize(1, { message: RESERVATION_MESSAGES.VALIDATION.SEAT_IDS_EMPTY })
	segments!: CreateReservationSegmentDto[];

	@ApiProperty({
		description: 'Number of passengers',
		example: 1,
		minimum: 1,
	})
	@IsNotEmpty({ message: RESERVATION_MESSAGES.VALIDATION.SEAT_IDS_REQUIRED })
	@IsInt({ message: RESERVATION_MESSAGES.VALIDATION.SEAT_IDS_REQUIRED })
	@Min(1, { message: RESERVATION_MESSAGES.VALIDATION.SEAT_IDS_REQUIRED })
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

