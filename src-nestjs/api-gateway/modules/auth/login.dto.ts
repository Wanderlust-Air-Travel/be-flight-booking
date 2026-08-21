import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
    @ApiProperty({
        description: 'Email address used for login',
        example: 'user@example.com',
        format: 'email',
    })
    @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
    @IsEmail()
    email: string;

    @ApiProperty({
        description: 'User password (6-20 characters)',
        example: 'StrongP@ssw0rd',
        minLength: 6,
        maxLength: 20,
    })
    @IsString()
    @MinLength(6)
    @MaxLength(20)
    password: string;
}
