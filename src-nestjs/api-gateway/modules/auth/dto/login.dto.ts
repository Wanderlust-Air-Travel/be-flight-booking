import { IsEmail, MinLength, MaxLength, IsString, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { AUTH_MESSAGES } from "src/shared/constants/messages";

export class LoginDto {
    @ApiProperty({
        description: 'Email address used for login',
        example: 'user@example.com',
        format: 'email',
    })
    @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
    @IsEmail({}, { message: AUTH_MESSAGES.VALIDATION.EMAIL_INVALID })
    @IsNotEmpty({ message: AUTH_MESSAGES.VALIDATION.EMAIL_REQUIRED })
    email: string;

    @ApiProperty({
        description: 'User password (6-20 characters)',
        example: 'StrongP@ssw0rd',
        minLength: 6,
        maxLength: 20,
    })
    @IsString({ message: AUTH_MESSAGES.VALIDATION.PASSWORD_REQUIRED })
    @MinLength(6, { message: AUTH_MESSAGES.VALIDATION.PASSWORD_REQUIRED })
    @MaxLength(20, { message: AUTH_MESSAGES.VALIDATION.PASSWORD_REQUIRED })
    @IsNotEmpty({ message: AUTH_MESSAGES.VALIDATION.PASSWORD_REQUIRED })
    password: string;
}