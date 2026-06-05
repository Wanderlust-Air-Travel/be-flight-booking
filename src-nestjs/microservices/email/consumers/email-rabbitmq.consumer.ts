import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { RabbitMQService } from 'src/shared/modules/rabbitmq/rabbitmq.service';
import type { SendEmailDto } from '../dto/send-email.dto';
import type { EmailService } from '../email.service';

/**
 * Email RabbitMQ Consumer
 *
 * Consumes email messages from RabbitMQ queue and processes them.
 * This allows for async email processing and better scalability.
 */
@Injectable()
export class EmailRabbitMQConsumer implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(EmailRabbitMQConsumer.name);
    private consumerTag: string | null = null;
    private readonly queueName: string;

    constructor(
        private readonly rabbitMQService: RabbitMQService,
        private readonly emailService: EmailService,
        private readonly configService: ConfigService
    ) {
        this.queueName = this.configService.get<string>(
            'RABBITMQ_QUEUE_EMAIL',
            'email_notifications'
        );
    }

    async onModuleInit() {
        // Wait for RabbitMQ connection
        if (!this.rabbitMQService.isConnected()) {
            this.rabbitMQService.getEventEmitter().once('connected', () => {
                this.startConsuming();
            });
        } else {
            await this.startConsuming();
        }
    }

    async onModuleDestroy() {
        await this.stopConsuming();
    }

    /**
     * Start consuming messages from RabbitMQ queue
     */
    private async startConsuming(): Promise<void> {
        try {
            // Ensure queue exists with DLQ support
            // Email TTL: 1 hour (3600000 ms), max retries: 3
            await this.rabbitMQService.assertQueueWithDLQ(
                this.queueName,
                `${this.queueName}.dlq`,
                3, // maxRetries
                3600000, // messageTtl: 1 hour
                0 // priority: normal
            );

            // Start consuming with max retries
            this.consumerTag = await this.rabbitMQService.consume(
                this.queueName,
                async (msg) => {
                    if (!msg) {
                        return;
                    }

                    try {
                        const messageContent = JSON.parse(msg.content.toString());
                        // Extract correlation ID if present
                        const correlationId =
                            messageContent.correlationId ||
                            msg.properties.correlationId ||
                            'unknown';
                        const messageId =
                            messageContent.messageId || msg.properties.messageId || 'unknown';

                        // Remove metadata before processing
                        const { timestamp, ...emailDto } = messageContent;

                        this.logger.log(
                            `Processing email message from queue: ${emailDto.to} [correlationId: ${correlationId}, messageId: ${messageId}]`
                        );

                        // Process email
                        await this.emailService.sendEmail(emailDto as SendEmailDto);

                        this.logger.log(
                            `Email processed successfully: ${emailDto.to} [correlationId: ${correlationId}]`
                        );
                    } catch (error: any) {
                        this.logger.error(
                            `Error processing email message: ${error.message}`,
                            error.stack
                        );
                        // Message will be handled by RabbitMQService (retry or DLQ)
                        throw error;
                    }
                },
                {
                    noAck: false, // Manual acknowledgment
                    maxRetries: 3, // Max retries before DLQ
                }
            );

            this.logger.log(
                `Started consuming emails from queue: ${this.queueName} (with DLQ support)`
            );
        } catch (error: any) {
            this.logger.error(`Failed to start consuming emails: ${error.message}`, error.stack);
        }
    }

    /**
     * Stop consuming messages
     */
    private async stopConsuming(): Promise<void> {
        if (this.consumerTag) {
            try {
                const channel = await this.rabbitMQService.getChannel(`consumer-${this.queueName}`);
                await channel.cancel(this.consumerTag);
                this.logger.log('Stopped consuming emails from queue');
                this.consumerTag = null;
            } catch (error: any) {
                this.logger.error(`Error stopping email consumer: ${error.message}`);
            }
        }
    }
}
