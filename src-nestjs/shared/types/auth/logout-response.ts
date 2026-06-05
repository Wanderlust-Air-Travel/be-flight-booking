import { ApiProperty } from '@nestjs/swagger';

export class LogoutResponse {
    @ApiProperty({ example: true })
    success: boolean;
}
