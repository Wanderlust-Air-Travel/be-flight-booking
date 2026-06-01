import { IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SendEmailDto } from './send-email.dto';

export class SendBatchEmailsDto {
	@ApiProperty({
		description: 'Array of emails to send',
		type: [SendEmailDto],
	})
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => SendEmailDto)
	emails!: SendEmailDto[];

	@ApiPropertyOptional({
		description: 'Delay between emails in milliseconds (for rate limiting)',
		default: 600,
	})
	@IsOptional()
	delayBetweenEmails?: number;
}

