import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class SendOtpPasswordResetDto {
	@ApiProperty({
		description: 'User email for password reset OTP',
		example: 'user@example.com',
	})
	@IsEmail({}, { message: 'Invalid email format' })
	@IsNotEmpty()
	email: string;
}

