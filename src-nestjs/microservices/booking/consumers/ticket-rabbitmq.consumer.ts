import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMQService } from 'src/shared/modules/rabbitmq/rabbitmq.service';
import { BookingService } from '../booking.service';
import * as amqp from 'amqplib';

/**
 * Ticket RabbitMQ Consumer
 * 
 * Consumes ticket creation messages from RabbitMQ queue and processes them.
 * This allows for async ticket creation after payment confirmation.
 */
@Injectable()
export class TicketRabbitMQConsumer implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(TicketRabbitMQConsumer.name);
	private consumerTag: string | null = null;
	private readonly queueName: string;

	constructor(
		private readonly rabbitMQService: RabbitMQService,
		private readonly bookingService: BookingService,
		private readonly configService: ConfigService,
	) {
		this.queueName = this.configService.get<string>('RABBITMQ_QUEUE_TICKETS', 'ticket_creation');
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
			// Ticket TTL: 24 hours (86400000 ms), max retries: 3, priority: 100 (high)
			await this.rabbitMQService.assertQueueWithDLQ(
				this.queueName,
				`${this.queueName}.dlq`,
				3, // maxRetries
				86400000, // messageTtl: 24 hours
				100, // priority: high (tickets are critical)
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
						const correlationId = messageContent.correlationId || msg.properties.correlationId || 'unknown';
						const messageId = messageContent.messageId || msg.properties.messageId || 'unknown';

						// Remove metadata before processing
						const {
							correlationId: _,
							messageId: __,
							timestamp: ___,
							idempotencyKey: ____,
							...payload
						} = messageContent;

						this.logger.log(
							`Processing ticket creation message from queue: ${payload.bookingId} [correlationId: ${correlationId}, messageId: ${messageId}]`,
						);

						// Create tickets from booking
						await this.bookingService.createTicketsFromBooking(payload.bookingId);

						this.logger.log(
							`Tickets created successfully for booking: ${payload.bookingId} [correlationId: ${correlationId}]`,
						);
					} catch (error: any) {
						this.logger.error(`Error processing ticket creation message: ${error.message}`, error.stack);
						// Message will be handled by RabbitMQService (retry or DLQ)
						throw error;
					}
				},
				{
					noAck: false, // Manual acknowledgment
					maxRetries: 3, // Max retries before DLQ
				},
			);

			this.logger.log(`Started consuming ticket creation messages from queue: ${this.queueName} (with DLQ support)`);
		} catch (error: any) {
			this.logger.error(`Failed to start consuming ticket creation messages: ${error.message}`, error.stack);
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
				this.logger.log('Stopped consuming ticket creation messages from queue');
				this.consumerTag = null;
			} catch (error: any) {
				this.logger.error(`Error stopping ticket creation consumer: ${error.message}`);
			}
		}
	}
}

