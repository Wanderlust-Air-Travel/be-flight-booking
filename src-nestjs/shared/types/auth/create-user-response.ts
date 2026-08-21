import { ApiProperty } from '@nestjs/swagger';

class CreateUserResponseUser {
    @ApiProperty({
        example: 'a3f1f8e6-5a6b-4b2d-9f1a-2c3d4e5f6a7b',
        description: 'User unique identifier',
    })
    id: string;

    @ApiProperty({
        example: 'user@example.com',
        description: 'User email address',
        format: 'email',
    })
    email: string;

    @ApiProperty({ example: 'Nguyen Van A', description: 'User full name' })
    fullname: string;

    @ApiProperty({ example: '0901234567', description: 'User phone number', nullable: true })
    phone: string | null;
}

export class CreateUserResponse {
    @ApiProperty({ type: CreateUserResponseUser })
    user: CreateUserResponseUser;

    @ApiProperty({
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        description: 'JWT access token',
    })
    access_token: string;

    @ApiProperty({
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        description: 'JWT refresh token',
    })
    refresh_token: string;
}
