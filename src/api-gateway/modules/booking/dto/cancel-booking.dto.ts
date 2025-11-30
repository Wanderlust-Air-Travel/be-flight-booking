import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, Length, Matches } from 'class-validator';
import { AUTH_MESSAGES } from 'src/shared/constants/messages';

export class CancelBookingDto {
	@ApiProperty({
		description: 'OTP code for cancellation (required if booking status is "paid")',
		example: '123456',
		minLength: 6,
		maxLength: 6,
		required: false,
	})
	@IsOptional()
	@IsString({ message: AUTH_MESSAGES.VALIDATION.OTP_REQUIRED })
	@Length(6, 6, { message: AUTH_MESSAGES.VALIDATION.OTP_INVALID_FORMAT })
	@Matches(/^[0-9]{6}$/, { message: AUTH_MESSAGES.VALIDATION.OTP_INVALID_FORMAT })
	otp?: string;
}

