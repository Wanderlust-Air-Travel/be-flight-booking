import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEmail, IsOptional, IsArray, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { IsUUIDv7 } from 'src/shared/validators/is-uuid-v7.validator';

export class CreateBookingPassengerDto {
	@ApiProperty({
		description: 'Passenger ID (optional, if not provided, will create new passenger)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
		required: false,
	})
	@IsOptional()
	@IsUUIDv7()
	passengerId?: string;

	@ApiProperty({
		description: 'Passenger type: ADT (adult), CHD (child), INF (infant)',
		example: 'ADT',
	})
	@IsNotEmpty()
	@IsString()
	passengerType!: string; // ADT, CHD, INF
}

export class CreateBookingSegmentDto {
	@ApiProperty({
		description: 'Flight instance ID',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@IsNotEmpty()
	@IsUUIDv7()
	flightInstanceId!: string;

	@ApiProperty({
		description: 'Fare class code',
		example: 'Y',
	})
	@IsNotEmpty()
	@IsString()
	fareClassCode!: string;

	@ApiProperty({
		description: 'Base fare amount',
		example: 1448000,
	})
	@IsNotEmpty()
	@IsInt()
	@Min(0)
	baseFare!: number;

	@ApiProperty({
		description: 'Tax amount',
		example: 0,
	})
	@IsNotEmpty()
	@IsInt()
	@Min(0)
	taxAmount!: number;

	@ApiProperty({
		description: 'Fee amount',
		example: 0,
	})
	@IsNotEmpty()
	@IsInt()
	@Min(0)
	feeAmount!: number;

	@ApiProperty({
		description: 'Flight seat ID (optional, can be assigned later)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
		required: false,
	})
	@IsOptional()
	@IsUUIDv7()
	flightSeatId?: string;
}

export class CreateBookingDto {
	@ApiProperty({
		description: 'User ID (optional, for guest bookings)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
		required: false,
	})
	@IsOptional()
	@IsUUIDv7()
	userId?: string;

	@ApiProperty({
		description: 'Currency code',
		example: 'VND',
	})
	@IsNotEmpty()
	@IsString()
	currencyCode!: string;

	@ApiProperty({
		description: 'Contact full name',
		example: 'Nguyen Van A',
	})
	@IsNotEmpty()
	@IsString()
	contactFullname!: string;

	@ApiProperty({
		description: 'Contact email',
		example: 'nguyenvana@example.com',
	})
	@IsNotEmpty()
	@IsEmail()
	contactEmail!: string;

	@ApiProperty({
		description: 'Contact phone',
		example: '0912345678',
	})
	@IsNotEmpty()
	@IsString()
	contactPhone!: string;

	@ApiProperty({
		description: 'Booking channel',
		example: 'web',
		required: false,
	})
	@IsOptional()
	@IsString()
	channel?: string;

	@ApiProperty({
		description: 'List of passengers',
		type: [CreateBookingPassengerDto],
	})
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateBookingPassengerDto)
	passengers!: CreateBookingPassengerDto[];

	@ApiProperty({
		description: 'List of booking segments (flight instances with fare classes)',
		type: [CreateBookingSegmentDto],
	})
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateBookingSegmentDto)
	segments!: CreateBookingSegmentDto[];
}

