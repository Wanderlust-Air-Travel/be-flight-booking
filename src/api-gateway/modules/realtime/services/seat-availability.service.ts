import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RealtimeGateway } from '../realtime.gateway';
import { RealtimeService } from '../realtime.service';
import { RedisService } from 'src/shared/modules/redis/redis.service';
import Redis from 'ioredis';
import { SeatAvailabilityChange, SeatAvailabilityMessage } from '../types/seat-availability.types';

/**
 * Seat Availability Service
 * High Priority: Prevents seat selection conflicts
 * 
 * Architecture:
 * - Uses Redis Pub/Sub to broadcast seat changes across all instances
 * - When a seat is selected/reserved, publishes event to Redis channel
 * - All connected clients subscribed to that flight receive real-time updates
 * - Updates seat map state in real-time to prevent conflicts
 */
@Injectable()
export class SeatAvailabilityService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(SeatAvailabilityService.name);
	private readonly redisSubscriber: Redis;
	private readonly channelPrefix = 'seat:availability:';
	private readonly subscribedChannels = new Set<string>();

	constructor(
		private readonly realtimeGateway: RealtimeGateway,
		private readonly realtimeService: RealtimeService,
		private readonly redisService: RedisService,
	) {
		// Create a separate Redis connection for pub/sub (required by Redis)
		const redisClient = this.redisService.getClient();
		this.redisSubscriber = redisClient.duplicate();
	}

	async onModuleInit() {
		// Subscribe to Redis pub/sub messages
		this.redisSubscriber.on('message', (channel, message) => {
			this.handleRedisMessage(channel, message);
		});

		this.redisSubscriber.on('pmessage', (pattern, channel, message) => {
			this.handleRedisMessage(channel, message);
		});

		this.logger.log('Seat Availability Service initialized');
	}

	async onModuleDestroy() {
		// Unsubscribe from all channels
		if (this.subscribedChannels.size > 0) {
			await this.redisSubscriber.unsubscribe(...Array.from(this.subscribedChannels));
		}
		await this.redisSubscriber.quit();
		this.logger.log('Seat Availability Service destroyed');
	}

	/**
	 * Subscribe a client to seat availability updates for a flight
	 */
	async subscribe(socketId: string, flightInstanceId: string): Promise<void> {
		this.realtimeService.initializeClient(socketId);
		this.realtimeService.addSubscription(socketId, 'seatAvailability', flightInstanceId);

		const channel = this.getChannel(flightInstanceId);

		// Subscribe to Redis channel if not already subscribed
		if (!this.subscribedChannels.has(channel)) {
			await this.redisSubscriber.subscribe(channel);
			this.subscribedChannels.add(channel);
			this.logger.log(`Subscribed to Redis channel: ${channel}`);
		}
	}

	/**
	 * Unsubscribe a client from seat availability updates
	 */
	async unsubscribe(socketId: string, flightInstanceId: string): Promise<void> {
		this.realtimeService.removeSubscription(socketId, 'seatAvailability', flightInstanceId);

		// Check if any other clients are subscribed to this flight
		const subscribedClients = this.realtimeService.getSubscribedClients(
			'seatAvailability',
			flightInstanceId,
		);

		// If no clients are subscribed, unsubscribe from Redis channel
		if (subscribedClients.length === 0) {
			const channel = this.getChannel(flightInstanceId);
			await this.redisSubscriber.unsubscribe(channel);
			this.subscribedChannels.delete(channel);
			this.logger.log(`Unsubscribed from Redis channel: ${channel}`);
		}
	}

	/**
	 * Publish seat availability change to Redis
	 * This should be called when:
	 * - A seat is selected/reserved
	 * - A seat is released (reservation expired/cancelled)
	 * - Seat availability is updated from any microservice
	 */
	async publishSeatChange(flightInstanceId: string, changes: SeatAvailabilityChange[]): Promise<void> {
		const channel = this.getChannel(flightInstanceId);
		const redisClient = this.redisService.getClient();

		const message: SeatAvailabilityMessage = {
			flightInstanceId,
			timestamp: new Date().toISOString(),
			changes,
		};

		await redisClient.publish(channel, JSON.stringify(message));
		this.logger.debug(`Published seat availability change for flight ${flightInstanceId}`);
	}

	/**
	 * Handle Redis pub/sub message
	 */
	private handleRedisMessage(channel: string, message: string): void {
		try {
			const flightInstanceId = channel.replace(this.channelPrefix, '');
			const data: SeatAvailabilityMessage = JSON.parse(message);

			// Get all clients subscribed to this flight
			const subscribedClients = this.realtimeService.getSubscribedClients(
				'seatAvailability',
				flightInstanceId,
			);

			// Broadcast to all subscribed clients
			const server = this.realtimeGateway.getServer();
			for (const socketId of subscribedClients) {
				server.to(socketId).emit('seat-availability:update', {
					flightInstanceId: data.flightInstanceId,
					changes: data.changes,
					timestamp: data.timestamp,
				});
			}

			this.logger.debug(
				`Broadcasted seat availability update to ${subscribedClients.length} clients for flight ${flightInstanceId}`,
			);
		} catch (error) {
			this.logger.error(`Error handling Redis message for channel ${channel}:`, error);
		}
	}

	/**
	 * Get Redis channel name for a flight
	 */
	private getChannel(flightInstanceId: string): string {
		return `${this.channelPrefix}${flightInstanceId}`;
	}
}

