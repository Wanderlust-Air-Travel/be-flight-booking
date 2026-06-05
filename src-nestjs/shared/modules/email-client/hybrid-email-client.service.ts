import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import type { SendEmailDto } from 'src/microservices/email/dto/send-email.dto';
import { EMAIL_MS } from 'src/microservices/email/email.messages';
import type { RabbitMQPublisherService } from '../rabbitmq/rabbitmq-publisher.service';

/**
 * Hybrid Email Client Service
 *
 * Automatically chooses between RabbitMQ (preferred) and TCP (fallback) for sending emails.
 * This ensures backward compatibility while leveraging RabbitMQ benefits.
 */
@Injectable()
export class HybridEmailClientService {
    private readonly logger = new Logger(HybridEmailClientService.name);
    private useRabbitMQ = true;

    constructor(
        @Optional() private readonly _rabbitMqPublisher: RabbitMQPublisherService | null,
        @Optional() @Inject('EMAIL_CLIENT') private readonly _emailClient: ClientProxy | null
    ) {
        // Prefer RabbitMQ if available
        this.useRabbitMQ = !!this.rabbitMQPublisher;
        if (!this.useRabbitMQ && !this.emailClient) {
            this.logger.warn(
                'Neither RabbitMQ nor TCP email client is available. Email sending will fail.'
            );
        }
    }

    /**
     * Send email (hybrid: RabbitMQ preferred, TCP fallback)
     */
    async sendEmail(dto: SendEmailDto): Promise<void> {
        // Try RabbitMQ first (preferred)
        if (this.useRabbitMQ && this.rabbitMQPublisher) {
            try {
                const published = await this.rabbitMQPublisher.publishEmail(dto);
                if (published) {
                    this.logger.debug(`Email queued via RabbitMQ: ${dto.to}`);
                    return;
                }
            } catch (error: any) {
                this.logger.warn(
                    `RabbitMQ email publishing failed, falling back to TCP: ${error.message}`
                );
                // Fall through to TCP fallback
            }
        }

        // Fallback to TCP
        if (this.emailClient) {
            try {
                await firstValueFrom(this.emailClient.send(EMAIL_MS.PATTERN.SEND_EMAIL, dto));
                this.logger.debug(`Email sent via TCP: ${dto.to}`);
            } catch (error: any) {
                this.logger.error(`Failed to send email via TCP: ${error.message}`);
                throw error;
            }
        } else {
            throw new Error('No email client available (neither RabbitMQ nor TCP)');
        }
    }
}
