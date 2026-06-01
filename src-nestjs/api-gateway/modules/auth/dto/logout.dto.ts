import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty } from "class-validator";
import { IsUUIDv7 } from "src/shared/validators/is-uuid-v7.validator";
import { AUTH_MESSAGES, COMMON_MESSAGES } from "src/shared/constants/messages";

export class LogoutDto {
  @ApiProperty({
    description: 'User ID (UUID v7)',
    example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
    format: 'uuid',
  })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsUUIDv7({ message: COMMON_MESSAGES.VALIDATION.ID_INVALID_UUID_V7 })
  @IsNotEmpty({ message: AUTH_MESSAGES.VALIDATION.USER_ID_REQUIRED })
  userId: string;
}


