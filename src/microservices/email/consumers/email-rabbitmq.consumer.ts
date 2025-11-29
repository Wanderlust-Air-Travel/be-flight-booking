import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMQService } from 'src/shared/modules/rabbitmq/rabbitmq.service';
import { EmailService } from '../email.service';
import { SendEmailDto } from '../dto/send-email.dto';
import * as amqp from 'amqplib';

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
		private readonly configService: ConfigService,
	) {
		this.queueName = this.configService.get<string>('RABBITMQ_QUEUE_EMAIL', 'email_notifications');
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
			// Ensure queue exists
			await this.rabbitMQService.assertQueue(this.queueName, undefined, {
				durable: true,
			});

			// Start consuming
			this.consumerTag = await this.rabbitMQService.consume(
				this.queueName,
				async (msg) => {
					if (!msg) {
						return;
					}

					try {
						const emailDto: SendEmailDto = JSON.parse(msg.content.toString());
						this.logger.log(`Processing email message from queue: ${emailDto.to}`);

						// Process email
						await this.emailService.sendEmail(emailDto);

						this.logger.log(`Email processed successfully: ${emailDto.to}`);
					} catch (error: any) {
						this.logger.error(`Error processing email message: ${error.message}`, error.stack);
						// Message will be nacked and requeued by RabbitMQService
						throw error;
					}
				},
				{
					noAck: false, // Manual acknowledgment
				},
			);

			this.logger.log(`Started consuming emails from queue: ${this.queueName}`);
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

