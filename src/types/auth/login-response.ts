import { ApiProperty } from '@nestjs/swagger';

class LoginResponseUser {
  @ApiProperty({ example: 'a3f1f8e6-5a6b-4b2d-9f1a-2c3d4e5f6a7b' })
  id: string;

  @ApiProperty({ example: 'user@example.com', format: 'email' })
  email: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  fullname: string;

  @ApiProperty({ example: '0901234567' })
  phone: string;
}

export class LoginResponse {
  @ApiProperty({ type: LoginResponseUser })
  user: LoginResponseUser;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refresh_token: string;
}


