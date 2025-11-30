import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEmail, IsOptional, IsArray, ValidateNested, IsInt, Min, ValidateIf, IsEnum, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { IsUUIDv7 } from 'src/shared/validators/is-uuid-v7.validator';
import { PassengerType } from 'src/shared/constants/enums';
import { BOOKING_MESSAGES, COMMON_MESSAGES } from 'src/shared/constants/messages';

export class CreateBookingPassengerDto {
	@ApiProperty({
		description: 'Passenger ID (optional - if provided, will use existing passenger; if not, will create new passenger from passengerInfo)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
		required: false,
	})
	@IsOptional()
	@IsUUIDv7()
	passengerId?: string;

	@ApiProperty({
		description: 'Passenger type: ADT (adult), CHD (child), INF (infant)',
		enum: PassengerType,
		example: PassengerType.ADT,
	})
	@IsNotEmpty({ message: BOOKING_MESSAGES.VALIDATION.PASSENGERS_REQUIRED })
	@IsEnum(PassengerType, { message: BOOKING_MESSAGES.VALIDATION.INVALID_PASSENGER_COUNT })
	passengerType!: PassengerType;

	// Passenger info for creating new passenger (required if passengerId is not provided)
	@ApiProperty({
		description: 'Passenger full name (required if passengerId is not provided)',
		example: 'Nguyen Van A',
		required: false,
	})
	@ValidateIf((o) => !o.passengerId)
	@IsNotEmpty({ message: BOOKING_MESSAGES.VALIDATION.PASSENGER_NAME_REQUIRED })
	@IsString({ message: BOOKING_MESSAGES.VALIDATION.PASSENGER_NAME_REQUIRED })
	@MinLength(2, { message: BOOKING_MESSAGES.VALIDATION.PASSENGER_NAME_REQUIRED })
	@MaxLength(100, { message: BOOKING_MESSAGES.VALIDATION.PASSENGER_NAME_REQUIRED })
	fullname?: string;

	@ApiProperty({
		description: 'Date of birth (YYYY-MM-DD) (required if passengerId is not provided)',
		example: '1990-01-15',
		required: false,
	})
	@ValidateIf((o) => !o.passengerId)
	@IsNotEmpty({ message: BOOKING_MESSAGES.VALIDATION.PASSENGERS_REQUIRED })
	@IsString({ message: BOOKING_MESSAGES.VALIDATION.PASSENGERS_REQUIRED })
	dob?: string;

	@ApiProperty({
		description: 'Gender: Male, Female, Other (required if passengerId is not provided)',
		example: 'Male',
		required: false,
	})
	@ValidateIf((o) => !o.passengerId)
	@IsNotEmpty({ message: BOOKING_MESSAGES.VALIDATION.PASSENGERS_REQUIRED })
	@IsString({ message: BOOKING_MESSAGES.VALIDATION.PASSENGERS_REQUIRED })
	gender?: string;

	@ApiProperty({
		description: 'Document number (CCCD/Passport) (required if passengerId is not provided)',
		example: '001234567890',
		required: false,
	})
	@ValidateIf((o) => !o.passengerId)
	@IsNotEmpty({ message: BOOKING_MESSAGES.VALIDATION.PASSENGERS_REQUIRED })
	@IsString({ message: BOOKING_MESSAGES.VALIDATION.PASSENGERS_REQUIRED })
	documentNumber?: string;

	@ApiProperty({
		description: 'Loyalty number (optional)',
		example: 'LOY123456',
		required: false,
	})
	@IsOptional()
	@IsString()
	loyaltyNumber?: string;

}

export class CreateBookingSegmentDto {
	@ApiProperty({
		description: 'Flight instance ID',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@IsNotEmpty({ message: BOOKING_MESSAGES.VALIDATION.FLIGHT_ID_REQUIRED })
	@IsUUIDv7({ message: COMMON_MESSAGES.VALIDATION.ID_INVALID_UUID_V7 })
	flightInstanceId!: string;

	@ApiProperty({
		description: 'Fare class code',
		example: 'Y',
	})
	@IsNotEmpty()
	@IsString()
	fareClassCode!: string;

	@ApiProperty({
		description: 'Base fare amount (optional - will be calculated from fare class if not provided)',
		example: 1448000,
		required: false,
	})
	@IsOptional()
	@IsInt()
	@Min(0)
	baseFare?: number;

	@ApiProperty({
		description: 'Tax amount (optional - defaults to 0 if not provided)',
		example: 0,
		required: false,
	})
	@IsOptional()
	@IsInt()
	@Min(0)
	taxAmount?: number;

	@ApiProperty({
		description: 'Fee amount (optional - defaults to 0 if not provided)',
		example: 0,
		required: false,
	})
	@IsOptional()
	@IsInt()
	@Min(0)
	feeAmount?: number;

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
		description: 'User ID (deprecated - will be extracted from JWT token automatically)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
		required: false,
		deprecated: true,
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
		description: 'Contact full name (optional, will use user fullname if not provided)',
		example: 'Nguyen Van A',
		required: false,
	})
	@IsOptional()
	@IsString()
	contactFullname?: string;

	@ApiProperty({
		description: 'Contact email (optional, will use user email if not provided)',
		example: 'nguyenvana@example.com',
		required: false,
	})
	@IsOptional()
	@IsEmail()
	contactEmail?: string;

	@ApiProperty({
		description: 'Contact phone (optional, will use user phone if not provided)',
		example: '0912345678',
		required: false,
	})
	@IsOptional()
	@IsString()
	contactPhone?: string;

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

