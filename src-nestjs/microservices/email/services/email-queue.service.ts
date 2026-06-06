import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailStatus } from 'src/shared/constants/enums';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - uuid package is ESM but works fine with CommonJS
import { v7 as uuidv7 } from 'uuid';
import type { EmailResponseDto } from '../dto/email-response.dto';
import type { SendEmailDto } from '../dto/send-email.dto';
import type { QueuedEmail } from '../interfaces/email-queue.interface';
import { EmailTemplateService } from './email-template.service';
import { GmailApiService } from './gmail-api.service';

@Injectable()
export class EmailQueueService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(EmailQueueService.name);
    private readonly queue: Map<string, QueuedEmail> = new Map();
    private readonly sendingQueue: QueuedEmail[] = [];
    private processing = false;
    private processingInterval: NodeJS.Timeout | null = null;
    private rateLimitInterval: NodeJS.Timeout | null = null;

    // Rate limiting: 100 emails per minute
    private readonly RATE_LIMIT = 100; // emails per minute
    private readonly RATE_WINDOW_MS = 60 * 1000; // 1 minute
    private readonly emailsSentInWindow: Date[] = [];

    // Retry configuration
    private MAX_RETRIES = 3;
    private readonly INITIAL_RETRY_DELAY_MS = 1000; // 1 second
    private readonly MAX_RETRY_DELAY_MS = 30000; // 30 seconds

    // Processing interval
    private readonly PROCESSING_INTERVAL_MS = 1000; // Process queue every 1 second

    constructor(
        private readonly gmailApiService: GmailApiService,
        private readonly emailTemplateService: EmailTemplateService,
        private readonly configService: ConfigService
    ) {
        this.MAX_RETRIES = this.configService.get<number>('EMAIL_MAX_RETRIES') || this.MAX_RETRIES;
    }

    async onModuleInit() {
        // Start processing queue
        this.startProcessing();
        this.logger.log('Email queue service started');
    }

    async onModuleDestroy() {
        this.stopProcessing();
        this.logger.log('Email queue service stopped');
    }

    /**
     * Add email to queue
     */
    async queueEmail(dto: SendEmailDto): Promise<EmailResponseDto> {
        const emailId = uuidv7();

        const queuedEmail: QueuedEmail = {
            id: emailId,
            dto,
            status: EmailStatus.QUEUED,
            retryCount: 0,
            maxRetries: this.MAX_RETRIES,
            queuedAt: new Date(),
        };

        this.queue.set(emailId, queuedEmail);
        this.sendingQueue.push(queuedEmail);

        this.logger.log(`Email queued: ${emailId} to ${dto.to}`);

        return this.mapToEmailResponse(queuedEmail);
    }

    /**
     * Get email status by ID
     */
    getEmailStatus(emailId: string): EmailResponseDto | null {
        const queuedEmail = this.queue.get(emailId);
        if (!queuedEmail) {
            return null;
        }
        return this.mapToEmailResponse(queuedEmail);
    }

    /**
     * Start processing queue
     */
    private startProcessing(): void {
        if (this.processing) {
            return;
        }

        this.processing = true;

        // Process queue at intervals
        this.processingInterval = setInterval(() => {
            this.processQueue();
        }, this.PROCESSING_INTERVAL_MS);

        // Clear rate limit window periodically
        this.rateLimitInterval = setInterval(() => {
            this.clearExpiredRateLimitEntries();
        }, this.RATE_WINDOW_MS);
    }

    /**
     * Stop processing queue
     */
    private stopProcessing(): void {
        this.processing = false;

        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }

        if (this.rateLimitInterval) {
            clearInterval(this.rateLimitInterval);
            this.rateLimitInterval = null;
        }
    }

    /**
     * Process queue
     */
    private async processQueue(): Promise<void> {
        if (this.sendingQueue.length === 0) {
            return;
        }

        // Check rate limit
        if (!this.canSendEmail()) {
            this.logger.debug('Rate limit reached, waiting...');
            return;
        }

        // Get next email to send
        const email = this.getNextEmailToSend();
        if (!email) {
            return;
        }

        // Update status
        email.status = EmailStatus.SENDING;

        try {
            // Prepare email content
            let subject = email.dto.subject || '';
            let htmlBody = email.dto.htmlBody || '';
            let textBody = email.dto.textBody;

            // If template is provided, render it
            if (email.dto.template) {
                const templateResult = await this.emailTemplateService.renderTemplate(
                    email.dto.template,
                    email.dto.templateData || {}
                );
                subject = templateResult.subject;
                htmlBody = templateResult.htmlBody;
                textBody = templateResult.textBody;
            }

            // Send email via Gmail API
            await this.gmailApiService.sendEmail(
                email.dto.to,
                subject,
                htmlBody,
                textBody,
                email.dto.replyTo,
                email.dto.attachments
            );

            // Success
            email.status = EmailStatus.SENT;
            email.sentAt = new Date();
            email.error = undefined;

            // Record email sent for rate limiting
            this.recordEmailSent();

            // Remove from sending queue
            const index = this.sendingQueue.indexOf(email);
            if (index > -1) {
                this.sendingQueue.splice(index, 1);
            }

            this.logger.log(`Email sent successfully: ${email.id} to ${email.dto.to}`);
        } catch (error: any) {
            this.logger.error(`Failed to send email ${email.id}: ${error.message}`);

            // Handle retry
            email.retryCount++;

            if (email.retryCount >= email.maxRetries) {
                // Max retries reached
                email.status = EmailStatus.FAILED;
                email.error = error.message;

                // Remove from sending queue
                const index = this.sendingQueue.indexOf(email);
                if (index > -1) {
                    this.sendingQueue.splice(index, 1);
                }

                this.logger.error(`Email failed after ${email.retryCount} retries: ${email.id}`);
            } else {
                // Schedule retry with exponential backoff
                const delay = Math.min(
                    this.INITIAL_RETRY_DELAY_MS * 2 ** (email.retryCount - 1),
                    this.MAX_RETRY_DELAY_MS
                );
                email.status = EmailStatus.QUEUED;
                email.nextRetryAt = new Date(Date.now() + delay);
                email.error = `Retrying in ${delay}ms: ${error.message}`;

                this.logger.warn(
                    `Email ${email.id} will retry in ${delay}ms (attempt ${email.retryCount}/${email.maxRetries})`
                );
            }
        }
    }

    /**
     * Get next email to send (respecting retry delays)
     */
    private getNextEmailToSend(): QueuedEmail | null {
        const now = Date.now();

        for (let i = 0; i < this.sendingQueue.length; i++) {
            const email = this.sendingQueue[i];

            // Skip if retry is scheduled for later
            if (email.nextRetryAt && email.nextRetryAt.getTime() > now) {
                continue;
            }

            // Remove from current position and return
            return this.sendingQueue.splice(i, 1)[0];
        }

        return null;
    }

    /**
     * Check if we can send email (rate limiting)
     */
    private canSendEmail(): boolean {
        this.clearExpiredRateLimitEntries();
        return this.emailsSentInWindow.length < this.RATE_LIMIT;
    }

    /**
     * Record email sent for rate limiting
     */
    private recordEmailSent(): void {
        this.emailsSentInWindow.push(new Date());
    }

    /**
     * Clear expired rate limit entries
     */
    private clearExpiredRateLimitEntries(): void {
        const now = Date.now();
        const windowStart = now - this.RATE_WINDOW_MS;

        while (
            this.emailsSentInWindow.length > 0 &&
            this.emailsSentInWindow[0].getTime() < windowStart
        ) {
            this.emailsSentInWindow.shift();
        }
    }

    /**
     * Map queued email to response DTO
     */
    private mapToEmailResponse(email: QueuedEmail): EmailResponseDto {
        return {
            emailId: email.id,
            to: email.dto.to,
            subject: email.dto.subject || email.dto.template || 'N/A',
            status: email.status,
            error: email.error,
            queuedAt: email.queuedAt,
            sentAt: email.sentAt,
            retryCount: email.retryCount,
        };
    }

    /**
     * Check if Gmail is ready
     */
    isGmailReady(): boolean {
        return this.gmailApiService.isReady();
    }

    /**
     * Get queue statistics
     */
    getQueueStats(): {
        total: number;
        queued: number;
        sending: number;
        sent: number;
        failed: number;
        rateLimitRemaining: number;
    } {
        const stats = {
            total: this.queue.size,
            queued: 0,
            sending: 0,
            sent: 0,
            failed: 0,
            rateLimitRemaining: this.RATE_LIMIT - this.emailsSentInWindow.length,
        };

        for (const email of this.queue.values()) {
            switch (email.status) {
                case EmailStatus.QUEUED:
                    stats.queued++;
                    break;
                case EmailStatus.SENDING:
                    stats.sending++;
                    break;
                case EmailStatus.SENT:
                    stats.sent++;
                    break;
                case EmailStatus.FAILED:
                    stats.failed++;
                    break;
            }
        }

        return stats;
    }
}
