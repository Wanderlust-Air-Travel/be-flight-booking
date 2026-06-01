import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';
import { IsUUIDv7 } from 'src/shared/validators/is-uuid-v7.validator';
import { AUTH_MESSAGES, COMMON_MESSAGES } from 'src/shared/constants/messages';

export class VerifyOtpPaymentDto {
	@ApiProperty({
		description: 'User ID for payment OTP verification',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@IsString({ message: AUTH_MESSAGES.VALIDATION.USER_ID_REQUIRED })
	@IsNotEmpty({ message: AUTH_MESSAGES.VALIDATION.USER_ID_REQUIRED })
	@IsUUIDv7({ message: COMMON_MESSAGES.VALIDATION.ID_INVALID_UUID_V7 })
	userId: string;

	@ApiProperty({
		description: '6-digit OTP code',
		example: '123456',
		minLength: 6,
		maxLength: 6,
	})
	@IsString({ message: AUTH_MESSAGES.VALIDATION.OTP_REQUIRED })
	@IsNotEmpty({ message: AUTH_MESSAGES.VALIDATION.OTP_REQUIRED })
	@Length(6, 6, { message: AUTH_MESSAGES.VALIDATION.OTP_INVALID_FORMAT })
	@Matches(/^[0-9]{6}$/, { message: AUTH_MESSAGES.VALIDATION.OTP_INVALID_FORMAT })
	otp: string;
}

