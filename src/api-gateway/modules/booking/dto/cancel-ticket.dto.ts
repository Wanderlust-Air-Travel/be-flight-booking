import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, Length } from 'class-validator';

export class CancelTicketDto {
	@ApiProperty({
		description: 'OTP code for cancellation (required if booking status is "paid")',
		example: '123456',
		minLength: 6,
		maxLength: 6,
		required: false,
	})
	@IsOptional()
	@IsString()
	@Length(6, 6, { message: 'OTP must be exactly 6 digits' })
	otp?: string;
}

