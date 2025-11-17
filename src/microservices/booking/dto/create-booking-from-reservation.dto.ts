import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEmail, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateBookingPassengerDto } from './create-booking.dto';

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
	@IsString()
	contactFullname?: string;

	@ApiProperty({
		description: 'Contact email (optional - will use user info if not provided)',
		example: 'nguyenvana@example.com',
		required: false,
	})
	@IsOptional()
	@IsEmail()
	contactEmail?: string;

	@ApiProperty({
		description: 'Contact phone (optional - will use user info if not provided)',
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
		description: 'List of passengers for the booking',
		type: [CreateBookingPassengerDto],
	})
	@IsNotEmpty()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateBookingPassengerDto)
	passengers!: CreateBookingPassengerDto[];
}

