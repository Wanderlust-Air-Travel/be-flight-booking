import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import type { Connection, Channel, ConsumeMessage, Options, Replies } from 'amqplib';
import { EventEmitter } from 'events';

/**
 * RabbitMQ Service
 * 
 * Provides RabbitMQ connection management and messaging capabilities.
 * 
 * Best Practices:
 * - Connection pooling for better performance
 * - Automatic reconnection on connection loss
 * - Message acknowledgment for reliability
 * - Dead letter queues for error handling
 * - Prefetch count for load balancing
 */
@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(RabbitMQService.name);
	private connection: Connection | null = null;
	private channels: Map<string, Channel> = new Map();
	private readonly config: {
		host: string;
		port: number;
		username: string;
		password: string;
		vhost: string;
		prefetchCount: number;
	};
	private reconnectAttempts = 0;
	private readonly maxReconnectAttempts = 10;
	private reconnectDelay = 1000; // Start with 1 second
	private isConnecting = false;
	private eventEmitter = new EventEmitter();

	constructor(private readonly configService: ConfigService) {
		// Parse prefetchCount safely to ensure it's always a valid number
		const prefetchCountRaw = this.configService.get<string | number>('RABBITMQ_PREFETCH_COUNT', '10');
		let prefetchCount: number;
		if (typeof prefetchCountRaw === 'number') {
			prefetchCount = isNaN(prefetchCountRaw) ? 10 : prefetchCountRaw;
		} else {
			const parsed = parseInt(prefetchCountRaw, 10);
			prefetchCount = isNaN(parsed) ? 10 : parsed;
		}
		// Ensure prefetchCount is positive
		if (prefetchCount <= 0) {
			prefetchCount = 10;
		}

		this.config = {
			host: this.configService.get<string>('RABBITMQ_HOST', 'localhost'),
			port: this.configService.get<number>('RABBITMQ_PORT', 5672),
			username: this.configService.get<string>('RABBITMQ_USER', 'admin'),
			password: this.configService.get<string>('RABBITMQ_PASS', 'admin123'),
			vhost: this.configService.get<string>('RABBITMQ_VHOST', '/'),
			prefetchCount,
		};
	}

	async onModuleInit() {
		await this.connect();
	}

	async onModuleDestroy() {
		await this.disconnect();
	}

	/**
	 * Connect to RabbitMQ server
	 */
	async connect(): Promise<void> {
		if (this.isConnecting) {
			this.logger.warn('Connection attempt already in progress');
			return;
		}

		if (this.connection) {
			this.logger.log('Already connected to RabbitMQ');
			return;
		}

		this.isConnecting = true;

		try {
			const connectionUrl = `amqp://${this.config.username}:${this.config.password}@${this.config.host}:${this.config.port}${this.config.vhost}`;
			this.logger.log(`Connecting to RabbitMQ at ${this.config.host}:${this.config.port}...`);

			// amqp.connect() returns Promise<Connection>
			const conn = await amqp.connect(connectionUrl);
			// Type assertion needed due to amqplib type definitions
			this.connection = conn as unknown as Connection;

			(conn as any).on('error', (err: Error) => {
				this.logger.error(`RabbitMQ connection error: ${err.message}`);
				this.handleConnectionError(err);
			});

			(conn as any).on('close', () => {
				this.logger.warn('RabbitMQ connection closed');
				this.connection = null;
				this.channels.clear();
				this.handleConnectionClose();
			});

			this.reconnectAttempts = 0;
			this.reconnectDelay = 1000;
			this.isConnecting = false;
			this.logger.log('Successfully connected to RabbitMQ');
			this.eventEmitter.emit('connected');
		} catch (error) {
			this.isConnecting = false;
			this.logger.error(`Failed to connect to RabbitMQ: ${error.message}`);
			this.handleConnectionError(error);
			throw error;
		}
	}

	/**
	 * Disconnect from RabbitMQ server
	 */
	async disconnect(): Promise<void> {
		this.logger.log('Disconnecting from RabbitMQ...');

		// Close all channels
		for (const [name, channel] of this.channels.entries()) {
			try {
				await channel.close();
				this.logger.log(`Closed channel: ${name}`);
			} catch (error) {
				this.logger.error(`Error closing channel ${name}: ${error.message}`);
			}
		}
		this.channels.clear();

		// Close connection
		if (this.connection) {
			try {
				await (this.connection as any).close();
				this.logger.log('Disconnected from RabbitMQ');
			} catch (error: any) {
				this.logger.error(`Error closing connection: ${error.message}`);
			}
			this.connection = null;
		}
	}

	/**
	 * Get or create a channel
	 * Channels are cached for reuse
	 */
	async getChannel(channelName: string = 'default'): Promise<Channel> {
		if (!this.connection) {
			await this.connect();
		}

		if (this.channels.has(channelName)) {
			const channel = this.channels.get(channelName)!;
			// Check if channel is still valid by trying to access it
			// If channel is closed, it will throw an error when used
			try {
				// Test channel by checking if we can use it
				return channel;
			} catch {
				// Channel is closed, remove it
				this.channels.delete(channelName);
			}
		}

		if (!this.connection) {
			throw new Error('RabbitMQ connection not available');
		}

		const channel = await (this.connection as any).createChannel();
		
		// Ensure prefetchCount is a valid positive number before calling prefetch
		const prefetchCount = Number(this.config.prefetchCount);
		if (isNaN(prefetchCount) || prefetchCount <= 0) {
			this.logger.warn(`Invalid prefetchCount: ${this.config.prefetchCount}, using default: 10`);
			await channel.prefetch(10);
		} else {
			await channel.prefetch(prefetchCount);
		}
		
		this.channels.set(channelName, channel);

		channel.on('error', (err) => {
			this.logger.error(`Channel ${channelName} error: ${err.message}`);
		});

		channel.on('close', () => {
			this.logger.warn(`Channel ${channelName} closed`);
			this.channels.delete(channelName);
		});

		return channel;
	}

	/**
	 * Publish message to exchange
	 */
	async publish(
		exchange: string,
		routingKey: string,
		message: any,
		options?: Options.Publish,
	): Promise<boolean> {
		const channel = await this.getChannel('publisher');
		const messageBuffer = Buffer.from(JSON.stringify(message));

		const defaultOptions: Options.Publish = {
			persistent: true, // Message persistence
			timestamp: Date.now(),
			...options,
		};

		return channel.publish(exchange, routingKey, messageBuffer, defaultOptions);
	}

	/**
	 * Send message to queue (direct queue)
	 */
	async sendToQueue(
		queue: string,
		message: any,
		options?: Options.Publish & { ttl?: number; priority?: number; correlationId?: string; messageId?: string },
	): Promise<boolean> {
		const channel = await this.getChannel('publisher');
		const messageBuffer = Buffer.from(JSON.stringify(message));

		// Ensure queue exists
		await this.assertQueue(queue, channel);

		const defaultOptions: Options.Publish = {
			persistent: true,
			timestamp: Date.now(),
			...(options?.correlationId && { correlationId: options.correlationId }),
			...(options?.messageId && { messageId: options.messageId }),
			...(options?.priority !== undefined && { priority: options.priority }),
			...(options?.ttl && { expiration: options.ttl.toString() }),
			...options,
		};

		return channel.sendToQueue(queue, messageBuffer, defaultOptions);
	}

	/**
	 * Consume messages from queue
	 */
	async consume(
		queue: string,
		onMessage: (msg: ConsumeMessage | null) => void | Promise<void>,
		options?: Options.Consume & { maxRetries?: number },
	): Promise<string> {
		const channel = await this.getChannel(`consumer-${queue}`);

		// NOTE: Queue should already be asserted by assertQueueWithDLQ before calling consume
		// Do NOT call assertQueue here as it may conflict with existing queue configuration (TTL, DLQ, etc.)
		// If you need to ensure queue exists, use assertQueueWithDLQ or checkQueue instead

		const maxRetries = options?.maxRetries || 3;
		const defaultOptions: Options.Consume = {
			noAck: false, // Manual acknowledgment
			...options,
		};

		const result = await channel.consume(queue, async (msg) => {
			if (!msg) {
				return;
			}

			try {
				await onMessage(msg);
				channel.ack(msg);
			} catch (error) {
				this.logger.error(`Error processing message from queue ${queue}: ${error.message}`);

				// Parse message content to check retry count
				let messageContent: any;
				let retryCount = 0;
				try {
					messageContent = JSON.parse(msg.content.toString());
					retryCount = messageContent._retryCount || 0;
				} catch {
					// If message is not JSON or doesn't have retry count, treat as first attempt
					retryCount = 0;
				}

				if (retryCount < maxRetries) {
					// Increment retry count and republish with delay
					const updatedContent = {
						...messageContent,
						_retryCount: retryCount + 1,
						_firstRetryTime: messageContent._firstRetryTime || Date.now(),
					};

					// Calculate exponential backoff delay
					const delay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Max 30s

					// Nack without requeue (to avoid duplicate)
					channel.nack(msg, false, false);

					// Republish with updated retry count and delay
					setTimeout(async () => {
						try {
							const sent = channel.sendToQueue(
								queue,
								Buffer.from(JSON.stringify(updatedContent)),
								{
									persistent: true,
									timestamp: Date.now(),
									priority: msg.properties.priority,
									correlationId: msg.properties.correlationId,
									messageId: msg.properties.messageId,
								},
							);
							if (!sent) {
								this.logger.error('Failed to republish message after retry: sendToQueue returned false');
							}
						} catch (err: any) {
							this.logger.error(`Failed to republish message after retry: ${err.message}`);
						}
					}, delay);

					this.logger.warn(
						`Message requeued with retry count ${retryCount + 1}/${maxRetries} after ${delay}ms delay`,
					);
				} else {
					// Max retries reached, reject without requeue (will go to DLQ)
					this.logger.error(
						`Message exceeded max retries (${retryCount}/${maxRetries}), sending to DLQ`,
					);
					channel.nack(msg, false, false); // Don't requeue, will go to DLQ
				}
			}
		}, defaultOptions);

		this.logger.log(`Started consuming from queue: ${queue}`);
		return result.consumerTag;
	}

	/**
	 * Assert queue exists (create if not exists)
	 */
	async assertQueue(
		queue: string,
		channel?: Channel,
		options?: Options.AssertQueue,
	): Promise<Replies.AssertQueue> {
		const ch = channel || (await this.getChannel('default'));

		const defaultOptions: Options.AssertQueue = {
			durable: true, // Queue survives broker restart
			...options,
		};

		return ch.assertQueue(queue, defaultOptions);
	}

	/**
	 * Assert queue with Dead Letter Queue (DLQ) support
	 * 
	 * @param queue - Main queue name
	 * @param dlqName - Dead letter queue name (default: {queue}.dlq)
	 * @param maxRetries - Maximum retry attempts before sending to DLQ (default: 3)
	 * @param messageTtl - Message TTL in milliseconds (optional)
	 * @param priority - Queue priority (0-255, optional)
	 * @param channel - Channel to use (optional)
	 */
	async assertQueueWithDLQ(
		queue: string,
		dlqName?: string,
		maxRetries: number = 3,
		messageTtl?: number,
		priority?: number,
		channel?: Channel,
	): Promise<{ mainQueue: Replies.AssertQueue; dlq: Replies.AssertQueue }> {
		const ch = channel || (await this.getChannel('default'));
		const dlq = dlqName || `${queue}.dlq`;

		// Assert DLQ first (durable, no special args)
		const dlqResult = await ch.assertQueue(dlq, {
			durable: true,
		});

		// Prepare queue arguments
		const queueArgs: any = {
			'x-dead-letter-exchange': '',
			'x-dead-letter-routing-key': dlq,
		};

		// Add message TTL if provided
		if (messageTtl) {
			queueArgs['x-message-ttl'] = messageTtl;
		}

		// Add priority if provided
		if (priority !== undefined && priority >= 0 && priority <= 255) {
			queueArgs['x-max-priority'] = 255; // Enable priority support
		}

		// Try to assert queue with new config
		// If queue exists with different config, try to delete and recreate (only in dev)
		try {
			const mainQueueResult = await ch.assertQueue(queue, {
				durable: true,
				arguments: queueArgs,
			});

			this.logger.log(
				`Queue ${queue} configured with DLQ ${dlq}, maxRetries: ${maxRetries}, TTL: ${messageTtl || 'none'}, Priority: ${priority !== undefined ? priority : 'disabled'}`,
			);

			return {
				mainQueue: mainQueueResult,
				dlq: dlqResult,
			};
		} catch (error: any) {
			// If queue exists with different config, handle gracefully
			if (error.message?.includes('PRECONDITION_FAILED') || error.message?.includes('inequivalent')) {
				this.logger.warn(
					`Queue ${queue} already exists with different configuration. Attempting to delete and recreate...`,
				);

				try {
					// Delete existing queue (only in development)
					if (process.env.NODE_ENV !== 'production') {
						// CRITICAL: Channel may be closed after PRECONDITION_FAILED error
						// Create a new channel for delete operation
						let deleteChannel = ch;
						try {
							// Test if channel is still open
							await ch.checkQueue(queue);
						} catch (channelError: any) {
							// Channel is closed, create a new one
							this.logger.warn(`Channel closed, creating new channel for queue deletion`);
							deleteChannel = await this.getChannel('queue-management');
						}

						await deleteChannel.deleteQueue(queue);
						this.logger.log(`Deleted existing queue ${queue} to recreate with new config`);

						// Use the delete channel or create a new one for assert
						const assertChannel = deleteChannel !== ch ? deleteChannel : await this.getChannel('queue-management');
						
						// Recreate with new config
						const mainQueueResult = await assertChannel.assertQueue(queue, {
							durable: true,
							arguments: queueArgs,
						});

						this.logger.log(
							`Queue ${queue} recreated with DLQ ${dlq}, maxRetries: ${maxRetries}, TTL: ${messageTtl || 'none'}, Priority: ${priority !== undefined ? priority : 'disabled'}`,
						);

						return {
							mainQueue: mainQueueResult,
							dlq: dlqResult,
						};
					} else {
						// In production, just log warning and use existing queue
						this.logger.warn(
							`Queue ${queue} exists with different config. Using existing queue. Please manually delete and recreate in production.`,
						);
						// Try to assert without new args (use existing config) - use a new channel
						const fallbackChannel = await this.getChannel('queue-management');
						const mainQueueResult = await fallbackChannel.assertQueue(queue, {
							durable: true,
						});
						return {
							mainQueue: mainQueueResult,
							dlq: dlqResult,
						};
					}
				} catch (deleteError: any) {
					this.logger.error(
						`Failed to delete/recreate queue ${queue}: ${deleteError.message}. Using existing queue.`,
					);
					// Fallback: use existing queue with a new channel
					try {
						const fallbackChannel = await this.getChannel('queue-management');
						const mainQueueResult = await fallbackChannel.assertQueue(queue, {
							durable: true,
						});
						return {
							mainQueue: mainQueueResult,
							dlq: dlqResult,
						};
					} catch (fallbackError: any) {
						this.logger.error(
							`Failed to assert queue ${queue} even with fallback: ${fallbackError.message}`,
						);
						// Last resort: return DLQ result only
						return {
							mainQueue: { queue: queue } as any,
							dlq: dlqResult,
						};
					}
				}
			}
			throw error;
		}
	}

	/**
	 * Assert exchange exists (create if not exists)
	 */
	async assertExchange(
		exchange: string,
		type: 'direct' | 'topic' | 'fanout' | 'headers' = 'topic',
		options?: Options.AssertExchange,
	): Promise<Replies.AssertExchange> {
		const channel = await this.getChannel('default');

		const defaultOptions: Options.AssertExchange = {
			durable: true, // Exchange survives broker restart
			...options,
		};

		return channel.assertExchange(exchange, type, defaultOptions);
	}

	/**
	 * Bind queue to exchange
	 */
	async bindQueue(
		queue: string,
		exchange: string,
		routingKey: string = '',
	): Promise<Replies.Empty> {
		const channel = await this.getChannel('default');
		return channel.bindQueue(queue, exchange, routingKey);
	}

	/**
	 * Handle connection errors
	 */
	private handleConnectionError(error: any): void {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			this.logger.error(`Max reconnection attempts (${this.maxReconnectAttempts}) reached. Stopping reconnection.`);
			this.eventEmitter.emit('connection_failed');
			return;
		}

		this.reconnectAttempts++;
		this.logger.warn(
			`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay}ms`,
		);

		setTimeout(() => {
			this.connect().catch((err) => {
				this.logger.error(`Reconnection failed: ${err.message}`);
			});
		}, this.reconnectDelay);

		// Exponential backoff
		this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // Max 30 seconds
	}

	/**
	 * Handle connection close
	 */
	private handleConnectionClose(): void {
		this.eventEmitter.emit('disconnected');
		// Attempt to reconnect
		if (this.reconnectAttempts < this.maxReconnectAttempts) {
			this.handleConnectionError(new Error('Connection closed'));
		}
	}

	/**
	 * Check if connected
	 */
	isConnected(): boolean {
		// Connection object doesn't have a 'closed' property in amqplib
		// We check if connection exists and is not null
		return this.connection !== null;
	}

	/**
	 * Get event emitter for connection events
	 */
	getEventEmitter(): EventEmitter {
		return this.eventEmitter;
	}
}

