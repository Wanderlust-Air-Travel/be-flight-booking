import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { IsUUIDv7 } from 'src/shared/validators/is-uuid-v7.validator';
import { AUTH_MESSAGES, BOOKING_MESSAGES, COMMON_MESSAGES } from 'src/shared/constants/messages';

export class SendOtpCancellationDto {
	@ApiProperty({
		description: 'User ID for cancellation OTP',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@IsString({ message: AUTH_MESSAGES.VALIDATION.USER_ID_REQUIRED })
	@IsNotEmpty({ message: AUTH_MESSAGES.VALIDATION.USER_ID_REQUIRED })
	@IsUUIDv7({ message: COMMON_MESSAGES.VALIDATION.ID_INVALID_UUID_V7 })
	userId: string;

	@ApiProperty({
		description: 'Booking ID to cancel',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@IsString({ message: BOOKING_MESSAGES.VALIDATION.BOOKING_ID_REQUIRED })
	@IsNotEmpty({ message: BOOKING_MESSAGES.VALIDATION.BOOKING_ID_REQUIRED })
	@IsUUIDv7({ message: COMMON_MESSAGES.VALIDATION.ID_INVALID_UUID_V7 })
	bookingId: string;
}

