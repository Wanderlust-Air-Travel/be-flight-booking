import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMQService } from './rabbitmq.service';

/**
 * RabbitMQ Publisher Service
 * 
 * Provides high-level methods for publishing messages to RabbitMQ.
 * This service abstracts the RabbitMQ details and provides business-friendly methods.
 */
@Injectable()
export class RabbitMQPublisherService {
	private readonly logger = new Logger(RabbitMQPublisherService.name);
	private readonly emailQueue: string;
	private readonly ticketQueue: string;
	private readonly eventsExchange: string;

	constructor(
		private readonly rabbitMQService: RabbitMQService,
		private readonly configService: ConfigService,
	) {
		this.emailQueue = this.configService.get<string>('RABBITMQ_QUEUE_EMAIL', 'email_notifications');
		this.ticketQueue = this.configService.get<string>('RABBITMQ_QUEUE_TICKETS', 'ticket_creation');
		this.eventsExchange = this.configService.get<string>(
			'RABBITMQ_EXCHANGE_EVENTS',
			'flight_booking_events',
		);
	}

	/**
	 * Publish email message to email queue
	 */
	async publishEmail(message: any): Promise<boolean> {
		try {
			if (!this.rabbitMQService.isConnected()) {
				this.logger.warn('RabbitMQ not connected, attempting to connect...');
				await this.rabbitMQService.connect();
			}

			const sent = await this.rabbitMQService.sendToQueue(this.emailQueue, message);
			if (sent) {
				this.logger.log(`Email message published to queue: ${this.emailQueue}`);
			} else {
				this.logger.warn(`Failed to publish email message to queue: ${this.emailQueue}`);
			}
			return sent;
		} catch (error: any) {
			this.logger.error(`Error publishing email message: ${error.message}`, error.stack);
			throw error;
		}
	}

	/**
	 * Publish ticket creation message to ticket queue
	 */
	async publishTicketCreation(message: any): Promise<boolean> {
		try {
			if (!this.rabbitMQService.isConnected()) {
				this.logger.warn('RabbitMQ not connected, attempting to connect...');
				await this.rabbitMQService.connect();
			}

			const sent = await this.rabbitMQService.sendToQueue(this.ticketQueue, message);
			if (sent) {
				this.logger.log(`Ticket creation message published to queue: ${this.ticketQueue}`);
			} else {
				this.logger.warn(`Failed to publish ticket creation message to queue: ${this.ticketQueue}`);
			}
			return sent;
		} catch (error: any) {
			this.logger.error(`Error publishing ticket creation message: ${error.message}`, error.stack);
			throw error;
		}
	}

	/**
	 * Publish event to events exchange
	 */
	async publishEvent(routingKey: string, event: any): Promise<boolean> {
		try {
			if (!this.rabbitMQService.isConnected()) {
				this.logger.warn('RabbitMQ not connected, attempting to connect...');
				await this.rabbitMQService.connect();
			}

			// Ensure exchange exists
			await this.rabbitMQService.assertExchange(this.eventsExchange, 'topic', {
				durable: true,
			});

			const published = await this.rabbitMQService.publish(this.eventsExchange, routingKey, event);
			if (published) {
				this.logger.log(`Event published to exchange: ${this.eventsExchange}, routing key: ${routingKey}`);
			} else {
				this.logger.warn(
					`Failed to publish event to exchange: ${this.eventsExchange}, routing key: ${routingKey}`,
				);
			}
			return published;
		} catch (error: any) {
			this.logger.error(`Error publishing event: ${error.message}`, error.stack);
			throw error;
		}
	}
}

