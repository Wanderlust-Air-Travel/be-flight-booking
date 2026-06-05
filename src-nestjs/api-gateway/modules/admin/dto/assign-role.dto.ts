import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { SystemRole } from 'src/shared/constants/roles';

export class AssignRoleDto {
    @ApiProperty({
        description: 'User ID (UUID v7)',
        example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
    })
    @IsUUID('7')
    @IsNotEmpty()
    userId: string;

    @ApiProperty({
        description: 'Role code',
        example: 'FARE_MANAGER',
        enum: SystemRole,
    })
    @IsString()
    @IsNotEmpty()
    roleCode: SystemRole;
}
