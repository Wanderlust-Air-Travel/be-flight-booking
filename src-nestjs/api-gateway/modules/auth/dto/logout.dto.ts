import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { AUTH_MESSAGES, COMMON_MESSAGES } from 'src/shared/constants/messages';
import { IsUUIDv7 } from 'src/shared/validators/is-uuid-v7.validator';

export class LogoutDto {
    @ApiProperty({
        description: 'User ID (UUID v7)',
        example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
        format: 'uuid',
    })
    @IsUUIDv7({ message: COMMON_MESSAGES.VALIDATION.ID_INVALID_UUID_V7 })
    @IsNotEmpty({ message: AUTH_MESSAGES.VALIDATION.USER_ID_REQUIRED })
    userId: string;
}
