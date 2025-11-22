import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length, MinLength } from 'class-validator';

export class VerifyOtpPasswordResetDto {
	@ApiProperty({
		description: 'User email for password reset OTP verification',
		example: 'user@example.com',
	})
	@IsEmail({}, { message: 'Invalid email format' })
	@IsNotEmpty()
	email: string;

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

	@ApiProperty({
		description: 'New password',
		example: 'NewStrongP@ssw0rd',
		minLength: 8,
	})
	@IsString()
	@IsNotEmpty()
	@MinLength(8, { message: 'Password must be at least 8 characters' })
	newPassword: string;
}

