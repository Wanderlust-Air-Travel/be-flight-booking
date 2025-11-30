import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { AUTH_MESSAGES } from 'src/shared/constants/messages';
import { IsStrongPassword } from 'src/shared/validators/is-strong-password.validator';

export class VerifyOtpPasswordResetDto {
	@ApiProperty({
		description: 'User email for password reset OTP verification',
		example: 'user@example.com',
	})
	@IsEmail({}, { message: AUTH_MESSAGES.VALIDATION.EMAIL_INVALID })
	@IsNotEmpty({ message: AUTH_MESSAGES.VALIDATION.EMAIL_REQUIRED })
	email: string;

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

	@ApiProperty({
		description: 'New password (6-20 characters, must contain uppercase, lowercase, number, and special character)',
		example: 'NewStrongP@ssw0rd',
		minLength: 6,
		maxLength: 20,
	})
	@IsString({ message: AUTH_MESSAGES.VALIDATION.NEW_PASSWORD_REQUIRED })
	@IsNotEmpty({ message: AUTH_MESSAGES.VALIDATION.NEW_PASSWORD_REQUIRED })
	@IsStrongPassword({ message: AUTH_MESSAGES.VALIDATION.PASSWORD_TOO_WEAK })
	newPassword: string;
}

