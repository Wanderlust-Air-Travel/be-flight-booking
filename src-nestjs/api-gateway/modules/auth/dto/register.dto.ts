import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { AUTH_MESSAGES } from 'src/shared/constants/messages';
import { IsStrongPassword } from 'src/shared/validators/is-strong-password.validator';
import { IsVietnamesePhone } from 'src/shared/validators/is-vietnamese-phone.validator';

export class RegisterDto {
    @ApiProperty({
        description: 'Full name of the user',
        example: 'Nguyen Van A',
    })
    @IsString({ message: AUTH_MESSAGES.VALIDATION.FULLNAME_REQUIRED })
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @MinLength(2, { message: AUTH_MESSAGES.VALIDATION.FULLNAME_REQUIRED })
    @MaxLength(100, { message: AUTH_MESSAGES.VALIDATION.FULLNAME_REQUIRED })
    @IsNotEmpty({ message: AUTH_MESSAGES.VALIDATION.FULLNAME_REQUIRED })
    fullname: string;

    @ApiProperty({
        description: 'Email used as unique login identity',
        example: 'user@example.com',
        format: 'email',
    })
    @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
    @IsEmail({}, { message: AUTH_MESSAGES.VALIDATION.EMAIL_INVALID })
    @IsNotEmpty({ message: AUTH_MESSAGES.VALIDATION.EMAIL_REQUIRED })
    email: string;

    @ApiProperty({
        description:
            'Account password (6-20 characters, must contain uppercase, lowercase, number, and special character)',
        example: 'StrongP@ssw0rd',
        minLength: 6,
        maxLength: 20,
    })
    @IsString({ message: AUTH_MESSAGES.VALIDATION.PASSWORD_REQUIRED })
    @IsStrongPassword({ message: AUTH_MESSAGES.VALIDATION.PASSWORD_TOO_WEAK })
    @IsNotEmpty({ message: AUTH_MESSAGES.VALIDATION.PASSWORD_REQUIRED })
    password: string;

    @ApiProperty({
        description: 'Phone number for contact (Vietnamese format)',
        example: '0901234567',
    })
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsNotEmpty({ message: AUTH_MESSAGES.VALIDATION.PHONE_REQUIRED })
    @IsVietnamesePhone({ message: AUTH_MESSAGES.VALIDATION.PHONE_INVALID })
    phone: string;
}
