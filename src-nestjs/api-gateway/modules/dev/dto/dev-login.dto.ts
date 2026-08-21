import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class DevLoginDto {
    @ApiProperty({
        description: 'Email address of an existing test user',
        example: 'customer@flightbooking.com',
        format: 'email',
    })
    @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
    @IsEmail()
    email: string;
}
