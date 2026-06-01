import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEmail, IsOptional, IsArray, ValidateNested, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateBookingPassengerDto } from './create-booking.dto';
import { BOOKING_MESSAGES, AUTH_MESSAGES } from 'src/shared/constants/messages';
import { IsVietnamesePhone } from 'src/shared/validators/is-vietnamese-phone.validator';

/**
 * DTO for creating a booking from an existing reservation.
 * This DTO only requires passenger information and contact details.
 * Flight instance, fare class, and pricing information are retrieved from the reservation.
 */
export class CreateBookingFromReservationDto {
	@ApiProperty({
		description: 'Contact full name (optional - will use user info if not provided)',
		example: 'Nguyen Van A',
		required: false,
	})
	@IsOptional()
	@IsString({ message: AUTH_MESSAGES.VALIDATION.FULLNAME_REQUIRED })
	@MinLength(2, { message: AUTH_MESSAGES.VALIDATION.FULLNAME_REQUIRED })
	@MaxLength(100, { message: AUTH_MESSAGES.VALIDATION.FULLNAME_REQUIRED })
	contactFullname?: string;

	@ApiProperty({
		description: 'Contact email (optional - will use user info if not provided)',
		example: 'nguyenvana@example.com',
		required: false,
	})
	@IsOptional()
	@IsEmail({}, { message: AUTH_MESSAGES.VALIDATION.EMAIL_INVALID })
	contactEmail?: string;

	@ApiProperty({
		description: 'Contact phone (optional - will use user info if not provided)',
		example: '0912345678',
		required: false,
	})
	@IsOptional()
	@IsVietnamesePhone({ message: AUTH_MESSAGES.VALIDATION.PHONE_INVALID })
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
		description: 'List of passengers for the booking',
		type: [CreateBookingPassengerDto],
	})
	@IsNotEmpty({ message: BOOKING_MESSAGES.VALIDATION.PASSENGERS_REQUIRED })
	@IsArray({ message: BOOKING_MESSAGES.VALIDATION.PASSENGERS_REQUIRED })
	@ValidateNested({ each: true })
	@Type(() => CreateBookingPassengerDto)
	passengers!: CreateBookingPassengerDto[];
}

