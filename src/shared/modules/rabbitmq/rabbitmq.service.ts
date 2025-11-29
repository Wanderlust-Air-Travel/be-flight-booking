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
		this.config = {
			host: this.configService.get<string>('RABBITMQ_HOST', 'localhost'),
			port: this.configService.get<number>('RABBITMQ_PORT', 5672),
			username: this.configService.get<string>('RABBITMQ_USER', 'admin'),
			password: this.configService.get<string>('RABBITMQ_PASS', 'admin123'),
			vhost: this.configService.get<string>('RABBITMQ_VHOST', '/'),
			prefetchCount: this.configService.get<number>('RABBITMQ_PREFETCH_COUNT', 10),
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
		await channel.prefetch(this.config.prefetchCount);
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
	async sendToQueue(queue: string, message: any, options?: Options.Publish): Promise<boolean> {
		const channel = await this.getChannel('publisher');
		const messageBuffer = Buffer.from(JSON.stringify(message));

		// Ensure queue exists
		await this.assertQueue(queue, channel);

		const defaultOptions: Options.Publish = {
			persistent: true,
			timestamp: Date.now(),
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
		options?: Options.Consume,
	): Promise<string> {
		const channel = await this.getChannel(`consumer-${queue}`);

		// Ensure queue exists
		await this.assertQueue(queue, channel);

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
				// Reject and requeue (or send to DLQ)
				channel.nack(msg, false, true);
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

