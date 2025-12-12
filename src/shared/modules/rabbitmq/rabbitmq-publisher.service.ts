import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMQService } from './rabbitmq.service';
import { RedisService } from '../redis/redis.service';
import { CircuitBreakerService } from '../../services/circuit-breaker.service';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - uuid package is ESM but works fine with CommonJS
import { v7 as uuidv7 } from 'uuid';

/**
 * RabbitMQ Publisher Service
 * 
 * Provides high-level methods for publishing messages to RabbitMQ.
 * This service abstracts the RabbitMQ details and provides business-friendly methods.
 * 
 * Features:
 * - Message deduplication (idempotency)
 * - Correlation IDs for tracing
 * - Message TTL support
 * - Priority queues
 * - Circuit breaker integration
 */
@Injectable()
export class RabbitMQPublisherService {
	private readonly logger = new Logger(RabbitMQPublisherService.name);
	private readonly emailQueue: string;
	private readonly ticketQueue: string;
	private readonly eventsExchange: string;
	private readonly enableIdempotency: boolean;
	private readonly idempotencyTtl: number; // TTL for idempotency keys in seconds

	constructor(
		private readonly rabbitMQService: RabbitMQService,
		private readonly configService: ConfigService,
		@Optional() private readonly redisService?: RedisService,
		@Optional() private readonly circuitBreakerService?: CircuitBreakerService,
	) {
		this.emailQueue = this.configService.get<string>('RABBITMQ_QUEUE_EMAIL', 'email_notifications');
		this.ticketQueue = this.configService.get<string>('RABBITMQ_QUEUE_TICKETS', 'ticket_creation');
		this.eventsExchange = this.configService.get<string>(
			'RABBITMQ_EXCHANGE_EVENTS',
			'flight_booking_events',
		);
		this.enableIdempotency = this.configService.get<boolean>('RABBITMQ_ENABLE_IDEMPOTENCY', true);
		this.idempotencyTtl = this.configService.get<number>('RABBITMQ_IDEMPOTENCY_TTL', 3600); // 1 hour default
	}

	/**
	 * Publish email message to email queue
	 * 
	 * @param message - Email message payload
	 * @param options - Publishing options (idempotencyKey, ttl, priority, correlationId)
	 */
	async publishEmail(
		message: any,
		options?: {
			idempotencyKey?: string;
			ttl?: number; // Message TTL in milliseconds
			priority?: number; // 0-255, higher = more priority
			correlationId?: string;
		},
	): Promise<boolean> {
		// Wrap with circuit breaker if available
		const executePublish = async (): Promise<boolean> => {
			if (!this.rabbitMQService.isConnected()) {
				this.logger.warn('RabbitMQ not connected, attempting to connect...');
				await this.rabbitMQService.connect();
			}

			// Generate correlation ID if not provided
			const correlationId = options?.correlationId || uuidv7();
			const messageId = uuidv7();

			// Check idempotency if enabled and key provided
			if (this.enableIdempotency && options?.idempotencyKey && this.redisService) {
				const idempotencyKey = `rabbitmq:idempotency:email:${options.idempotencyKey}`;
				const exists = await this.redisService.get(idempotencyKey);
				if (exists) {
					this.logger.warn(`Duplicate email message detected (idempotency key: ${options.idempotencyKey})`);
					return false; // Already processed
				}

				// Set idempotency key with TTL
				await this.redisService.set(idempotencyKey, { messageId, timestamp: Date.now() }, this.idempotencyTtl);
			}

			// Add metadata to message
			const messageWithMetadata = {
				...message,
				correlationId,
				messageId,
				timestamp: Date.now(),
				...(options?.idempotencyKey && { idempotencyKey: options.idempotencyKey }),
			};

			// Default TTL for emails: 1 hour (3600000 ms)
			const emailTtl = options?.ttl || 3600000;
			const priority = options?.priority || 0;

			const sent = await this.rabbitMQService.sendToQueue(this.emailQueue, messageWithMetadata, {
				ttl: emailTtl,
				priority,
				correlationId,
				messageId,
			});

			if (sent) {
				this.logger.log(
					`Email message published to queue: ${this.emailQueue} [correlationId: ${correlationId}, priority: ${priority}]`,
				);
			} else {
				this.logger.warn(`Failed to publish email message to queue: ${this.emailQueue}`);
			}
			return sent;
		};

		try {
			// Use circuit breaker if available
			if (this.circuitBreakerService) {
				return await this.circuitBreakerService.execute('rabbitmq-email-publisher', executePublish);
			}
			return await executePublish();
		} catch (error: any) {
			this.logger.error(`Error publishing email message: ${error.message}`, error.stack);
			throw error;
		}
	}

	/**
	 * Publish ticket creation message to ticket queue
	 * 
	 * @param message - Ticket creation payload (must contain bookingId)
	 * @param options - Publishing options (idempotencyKey, ttl, priority, correlationId)
	 */
	async publishTicketCreation(
		message: { bookingId: string; [key: string]: any },
		options?: {
			idempotencyKey?: string;
			ttl?: number; // Message TTL in milliseconds
			priority?: number; // 0-255, higher = more priority
			correlationId?: string;
		},
	): Promise<boolean> {
		// Wrap with circuit breaker if available
		const executePublish = async (): Promise<boolean> => {
			if (!this.rabbitMQService.isConnected()) {
				this.logger.warn('RabbitMQ not connected, attempting to connect...');
				await this.rabbitMQService.connect();
			}

			// Generate correlation ID if not provided
			const correlationId = options?.correlationId || uuidv7();
			const messageId = uuidv7();

			// Use bookingId as idempotency key if not provided
			const idempotencyKey = options?.idempotencyKey || message.bookingId;

			// Check idempotency if enabled
			if (this.enableIdempotency && this.redisService) {
				const idempotencyRedisKey = `rabbitmq:idempotency:ticket:${idempotencyKey}`;
				const exists = await this.redisService.get(idempotencyRedisKey);
				if (exists) {
					this.logger.warn(
						`Duplicate ticket creation message detected (bookingId: ${message.bookingId}, idempotency key: ${idempotencyKey})`,
					);
					return false; // Already processed
				}

				// Set idempotency key with TTL (longer for tickets: 24 hours)
				await this.redisService.set(
					idempotencyRedisKey,
					{ messageId, bookingId: message.bookingId, timestamp: Date.now() },
					86400, // 24 hours
				);
			}

			// Add metadata to message
			const messageWithMetadata = {
				...message,
				correlationId,
				messageId,
				timestamp: Date.now(),
				idempotencyKey,
			};

			// Default TTL for tickets: 24 hours (86400000 ms) - tickets are critical
			const ticketTtl = options?.ttl || 86400000;
			// Higher priority for ticket creation (critical business operation)
			const priority = options?.priority !== undefined ? options.priority : 100;

			const sent = await this.rabbitMQService.sendToQueue(this.ticketQueue, messageWithMetadata, {
				ttl: ticketTtl,
				priority,
				correlationId,
				messageId,
			});

			if (sent) {
				this.logger.log(
					`Ticket creation message published to queue: ${this.ticketQueue} [bookingId: ${message.bookingId}, correlationId: ${correlationId}, priority: ${priority}]`,
				);
			} else {
				this.logger.warn(`Failed to publish ticket creation message to queue: ${this.ticketQueue}`);
			}
			return sent;
		};

		try {
			// Use circuit breaker if available
			if (this.circuitBreakerService) {
				return await this.circuitBreakerService.execute('rabbitmq-ticket-publisher', executePublish);
			}
			return await executePublish();
		} catch (error: any) {
			this.logger.error(`Error publishing ticket creation message: ${error.message}`, error.stack);
			throw error;
		}
	}

	/**
	 * Publish event to events exchange
	 * 
	 * @param routingKey - Routing key for topic exchange (e.g., 'payment.success', 'booking.created')
	 * @param event - Event payload
	 * @param options - Publishing options (correlationId, priority)
	 */
	async publishEvent(
		routingKey: string,
		event: any,
		options?: {
			correlationId?: string;
			priority?: number;
		},
	): Promise<boolean> {
		try {
			if (!this.rabbitMQService.isConnected()) {
				this.logger.warn('RabbitMQ not connected, attempting to connect...');
				await this.rabbitMQService.connect();
			}

			// Ensure exchange exists
			await this.rabbitMQService.assertExchange(this.eventsExchange, 'topic', {
				durable: true,
			});

			// Generate correlation ID if not provided
			const correlationId = options?.correlationId || uuidv7();
			const messageId = uuidv7();

			// Add metadata to event
			const eventWithMetadata = {
				...event,
				correlationId,
				messageId,
				timestamp: Date.now(),
			};

			const priority = options?.priority || 0;

			const published = await this.rabbitMQService.publish(this.eventsExchange, routingKey, eventWithMetadata, {
				persistent: true,
				timestamp: Date.now(),
				correlationId,
				messageId,
				priority,
			});

			if (published) {
				this.logger.log(
					`Event published to exchange: ${this.eventsExchange}, routing key: ${routingKey} [correlationId: ${correlationId}]`,
				);
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

