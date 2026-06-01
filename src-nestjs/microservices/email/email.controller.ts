import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { EMAIL_MS } from './email.messages';
import { EmailService } from './email.service';
import { SendEmailDto } from './dto/send-email.dto';
import { SendBatchEmailsDto } from './dto/send-batch-emails.dto';

@Controller()
export class EmailMsController {
	private readonly logger = new Logger(EmailMsController.name);

	constructor(private readonly emailService: EmailService) {}

	@MessagePattern(EMAIL_MS.PATTERN.SEND_EMAIL)
	async handleSendEmail(@Payload() dto: SendEmailDto) {
		try {
			this.logger.log(`Send email to ${dto.to}`);
			const result = await this.emailService.sendEmail(dto);
			this.logger.log(`Email ${result.emailId} queued successfully`);
			return result;
		} catch (error: any) {
			this.logger.error('Send email error:', error);
			throw error;
		}
	}

	@MessagePattern(EMAIL_MS.PATTERN.SEND_BATCH_EMAILS)
	async handleSendBatchEmails(@Payload() dto: SendBatchEmailsDto) {
		try {
			this.logger.log(`Send batch emails: ${dto.emails.length} emails`);
			const result = await this.emailService.sendBatchEmails(dto);
			this.logger.log(`Batch emails queued successfully: ${result.length} emails`);
			return result;
		} catch (error: any) {
			this.logger.error('Send batch emails error:', error);
			throw error;
		}
	}

	@MessagePattern(EMAIL_MS.PATTERN.GET_EMAIL_STATUS)
	async handleGetEmailStatus(@Payload() payload: { emailId: string }) {
		try {
			this.logger.log(`Get email status: ${payload.emailId}`);
			const result = await this.emailService.getEmailStatus(payload.emailId);
			return result;
		} catch (error: any) {
			this.logger.error('Get email status error:', error);
			throw error;
		}
	}

	@MessagePattern(EMAIL_MS.PATTERN.HEALTH_CHECK)
	async handleHealthCheck() {
		try {
			const health = await this.emailService.getHealthStatus();
			return health;
		} catch (error: any) {
			this.logger.error('Health check error:', error);
			throw error;
		}
	}
}

