import { ApiProperty } from '@nestjs/swagger';

export class DevAccountDto {
    @ApiProperty({
        description: 'User ID (UUID v7)',
        example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
    })
    userId: string;

    @ApiProperty({
        description: 'Email address of the user',
        example: 'customer@flightbooking.com',
    })
    email: string;

    @ApiProperty({
        description: 'Full name of the user',
        example: 'Test Customer',
    })
    fullname: string;

    @ApiProperty({
        description: 'System role code assigned to the user',
        example: 'CUSTOMER',
    })
    roleCode: string;

    @ApiProperty({
        description: 'Display name of the role (Vietnamese)',
        example: 'Khách hàng',
    })
    roleName: string;

    @ApiProperty({
        description: 'Optional description of the role',
        example: 'Customer role (default for all users)',
        nullable: true,
    })
    roleDescription: string | null;
}
