import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length } from 'class-validator';
import { IsUUIDv7 } from 'src/shared/validators/is-uuid-v7.validator';

export class VerifyOtpCancellationDto {
	@ApiProperty({
		description: 'User ID for cancellation OTP verification',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@IsString()
	@IsNotEmpty()
	@IsUUIDv7({ message: 'userId must be a valid UUID v7' })
	userId: string;

	@ApiProperty({
		description: 'Booking ID to cancel',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@IsString()
	@IsNotEmpty()
	@IsUUIDv7({ message: 'bookingId must be a valid UUID v7' })
	bookingId: string;

	@ApiProperty({
		description: '6-digit OTP code',
		example: '123456',
		minLength: 6,
		maxLength: 6,
	})
	@IsString()
	@IsNotEmpty()
	@Length(6, 6, { message: 'OTP must be exactly 6 digits' })
	otp: string;
}

