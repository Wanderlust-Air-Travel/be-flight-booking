import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    IsEmail,
    IsNotEmpty,
    IsPhoneNumber,
    IsString,
    MaxLength,
    MinLength,
} from 'class-validator';

export class RegisterDto {
    @ApiProperty({
        description: 'Full name of the user',
        example: 'Nguyen Van A',
    })
    @IsString()
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @MinLength(2)
    @MaxLength(100)
    @IsNotEmpty()
    fullname: string;

    @ApiProperty({
        description: 'Email used as unique login identity',
        example: 'user@example.com',
        format: 'email',
    })
    @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
    @IsEmail()
    email: string;

    @ApiProperty({
        description: 'Account password (6-20 characters)',
        example: 'StrongP@ssw0rd',
        minLength: 6,
        maxLength: 20,
    })
    @IsString()
    @MinLength(6)
    @MaxLength(20)
    password: string;

    @ApiProperty({
        description: 'Phone number for contact',
        example: '0901234567',
    })
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsNotEmpty()
    @IsPhoneNumber('VN', { message: 'phone must be a valid Vietnamese phone number' })
    phone: string;
}
