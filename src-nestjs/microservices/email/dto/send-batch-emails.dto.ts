import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
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
