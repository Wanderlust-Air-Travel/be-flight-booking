import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmailStatus } from 'src/shared/constants/enums';

export class EmailResponseDto {
	@ApiProperty({ description: 'Email job ID' })
	emailId!: string;

	@ApiProperty({ description: 'Recipient email address' })
	to!: string;

	@ApiProperty({ description: 'Email subject' })
	subject!: string;

	@ApiProperty({ description: 'Email status', enum: EmailStatus })
	status!: EmailStatus;

	@ApiPropertyOptional({ description: 'Error message (if failed)' })
	error?: string;

	@ApiProperty({ description: 'Timestamp when email was queued' })
	queuedAt!: Date;

	@ApiPropertyOptional({ description: 'Timestamp when email was sent' })
	sentAt?: Date;

	@ApiProperty({ description: 'Number of retry attempts' })
	retryCount!: number;
}

