import { Injectable, Logger } from '@nestjs/common';
import type { SendEmailDto } from 'src/microservices/email/dto/send-email.dto';
import { RabbitMQPublisherService } from '../rabbitmq/rabbitmq-publisher.service';

/**
 * RabbitMQ Email Client Service
 *
 * Provides async email sending via RabbitMQ instead of direct TCP calls.
 * This improves system resilience and scalability.
 */
@Injectable()
export class RabbitMQEmailClientService {
    private readonly logger = new Logger(RabbitMQEmailClientService.name);

    constructor(private readonly rabbitMQPublisher: RabbitMQPublisherService) {}

    /**
     * Send email via RabbitMQ (async)
     *
     * This method publishes email messages to RabbitMQ queue instead of
     * making direct TCP calls to Email microservice.
     */
    async sendEmail(dto: SendEmailDto): Promise<{ success: boolean; message: string }> {
        try {
            const published = await this.rabbitMQPublisher.publishEmail(dto);
            if (published) {
                return {
                    success: true,
                    message: 'Email queued successfully',
                };
            }
            return {
                success: false,
                message: 'Failed to queue email',
            };
        } catch (error: any) {
            this.logger.error(`Error sending email via RabbitMQ: ${error.message}`, error.stack);
            throw error;
        }
    }
}
