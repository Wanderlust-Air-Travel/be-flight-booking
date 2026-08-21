import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { AUTH_MESSAGES } from 'src/shared/constants/messages';

export class SendOtpPasswordResetDto {
    @ApiProperty({
        description: 'User email for password reset OTP',
        example: 'user@example.com',
    })
    @IsEmail({}, { message: AUTH_MESSAGES.VALIDATION.EMAIL_INVALID })
    @IsNotEmpty({ message: AUTH_MESSAGES.VALIDATION.EMAIL_REQUIRED })
    email: string;
}
