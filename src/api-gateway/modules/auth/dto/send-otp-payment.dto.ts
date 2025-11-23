import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { IsUUIDv7 } from 'src/shared/validators/is-uuid-v7.validator';

export class SendOtpPaymentDto {
	@ApiProperty({
		description: 'User ID for payment OTP',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@IsString()
	@IsNotEmpty()
	@IsUUIDv7({ message: 'userId must be a valid UUID v7' })
	userId: string;
}

