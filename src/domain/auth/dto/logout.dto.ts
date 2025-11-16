import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsUUID } from "class-validator";

export class LogoutDto {
  @ApiProperty({
    description: 'User ID (UUID v4)',
    example: 'a3f1f8e6-5a6b-4b2d-9f1a-2c3d4e5f6a7b',
    format: 'uuid',
  })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsUUID()
  userId: string;
}


