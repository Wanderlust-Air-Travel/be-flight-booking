import { Injectable, Logger } from '@nestjs/common';
import type { EmailResponseDto } from './dto/email-response.dto';
import type { SendBatchEmailsDto } from './dto/send-batch-emails.dto';
import type { SendEmailDto } from './dto/send-email.dto';
import { EmailQueueService } from './services/email-queue.service';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);

    constructor(private readonly emailQueueService: EmailQueueService) {}

    /**
     * Send single email
     */
    async sendEmail(dto: SendEmailDto): Promise<EmailResponseDto> {
        this.logger.log(`Queuing email to ${dto.to}`);
        return await this.emailQueueService.queueEmail(dto);
    }

    /**
     * Send batch emails
     */
    async sendBatchEmails(dto: SendBatchEmailsDto): Promise<EmailResponseDto[]> {
        this.logger.log(`Queuing batch emails: ${dto.emails.length} emails`);
        const results: EmailResponseDto[] = [];

        for (const email of dto.emails) {
            try {
                const result = await this.emailQueueService.queueEmail(email);
                results.push(result);

                // Delay between emails if specified (for rate limiting)
                if (dto.delayBetweenEmails && dto.delayBetweenEmails > 0) {
                    await new Promise((resolve) => setTimeout(resolve, dto.delayBetweenEmails));
                }
            } catch (error: any) {
                this.logger.error(`Failed to queue email to ${email.to}: ${error.message}`);
                // Continue with other emails even if one fails
            }
        }

        return results;
    }

    /**
     * Get email status
     */
    async getEmailStatus(emailId: string): Promise<EmailResponseDto | null> {
        return this.emailQueueService.getEmailStatus(emailId);
    }

    /**
     * Get health status
     */
    async getHealthStatus(): Promise<{
        status: string;
        gmailReady: boolean;
        queueStats: {
            total: number;
            queued: number;
            sending: number;
            sent: number;
            failed: number;
            rateLimitRemaining: number;
        };
    }> {
        const queueStats = this.emailQueueService.getQueueStats();
        const gmailReady = this.emailQueueService.isGmailReady();

        return {
            status: 'ok',
            gmailReady,
            queueStats,
        };
    }
}
