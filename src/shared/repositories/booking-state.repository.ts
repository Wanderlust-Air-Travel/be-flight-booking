import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../modules/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { BookingState } from '../types/booking-state.types';
import { BookingStateStorageException } from '../exceptions/booking-state.exceptions';

/**
 * Repository pattern for booking state storage
 * Abstracts Redis operations and provides a clean interface
 * Follows Single Responsibility Principle
 */
@Injectable()
export class BookingStateRepository {
	private readonly logger = new Logger(BookingStateRepository.name);
	private readonly stateTtl: number;
	private readonly keyPrefix = 'booking:state';

	constructor(
		private readonly redisService: RedisService,
		private readonly configService: ConfigService,
	) {
		const redisConfig = this.configService.get('redis');
		// State expires after 30 minutes (longer than reservation TTL of 15 minutes)
		this.stateTtl = redisConfig?.ttl?.bookingState || 1800; // 30 minutes default
	}

	/**
	 * Generate Redis key for booking state
	 * Format: booking:state:{userId}:{flightInstanceId}
	 */
	private generateKey(userId: string, flightInstanceId: string): string {
		return `${this.keyPrefix}:${userId}:${flightInstanceId}`;
	}

	/**
	 * Save booking state to Redis
	 * @throws BookingStateStorageException if save fails
	 */
	async save(userId: string, flightInstanceId: string, state: BookingState): Promise<void> {
		const key = this.generateKey(userId, flightInstanceId);
		
		try {
			const saved = await this.redisService.set(key, state, this.stateTtl);
			
			if (!saved) {
				this.logger.error(`Failed to save booking state for key: ${key}`);
				throw new BookingStateStorageException('save', `Redis SET operation returned false for key: ${key}`);
			}

			this.logger.debug(`Booking state saved successfully: ${key}`);
		} catch (error) {
			if (error instanceof BookingStateStorageException) {
				throw error;
			}
			this.logger.error(`Unexpected error saving booking state: ${error}`, error instanceof Error ? error.stack : '');
			throw new BookingStateStorageException('save', error instanceof Error ? error.message : String(error));
		}
	}

	/**
	 * Get booking state from Redis
	 * @returns BookingState or null if not found
	 */
	async findOne(userId: string, flightInstanceId: string): Promise<BookingState | null> {
		const key = this.generateKey(userId, flightInstanceId);
		
		try {
			const state = await this.redisService.get<BookingState>(key);
			return state;
		} catch (error) {
			this.logger.error(`Error retrieving booking state for key: ${key}`, error instanceof Error ? error.stack : '');
			// Return null instead of throwing to allow graceful handling
			return null;
		}
	}

	/**
	 * Delete booking state from Redis
	 * @returns true if deleted, false if not found
	 */
	async delete(userId: string, flightInstanceId: string): Promise<boolean> {
		const key = this.generateKey(userId, flightInstanceId);
		
		try {
			const deleted = await this.redisService.del(key);
			if (deleted) {
				this.logger.debug(`Booking state deleted: ${key}`);
			}
			return deleted;
		} catch (error) {
			this.logger.error(`Error deleting booking state for key: ${key}`, error instanceof Error ? error.stack : '');
			return false;
		}
	}

	/**
	 * Delete all booking states for a user
	 * @returns number of deleted keys
	 */
	async deleteAllByUserId(userId: string): Promise<number> {
		const pattern = `${this.keyPrefix}:${userId}:*`;
		
		try {
			const keys = await this.redisService.keys(pattern);
			
			let deleted = 0;
			for (const key of keys) {
				if (await this.redisService.del(key)) {
					deleted++;
				}
			}

			this.logger.debug(`Deleted ${deleted} booking states for user: ${userId}`);
			return deleted;
		} catch (error) {
			this.logger.error(`Error deleting all booking states for user: ${userId}`, error instanceof Error ? error.stack : '');
			return 0;
		}
	}

	/**
	 * Check if booking state exists
	 */
	async exists(userId: string, flightInstanceId: string): Promise<boolean> {
		const key = this.generateKey(userId, flightInstanceId);
		return await this.redisService.exists(key);
	}

	/**
	 * Get TTL for booking state
	 * @returns TTL in seconds, -1 if no TTL, -2 if key doesn't exist
	 */
	async getTtl(userId: string, flightInstanceId: string): Promise<number> {
		const key = this.generateKey(userId, flightInstanceId);
		return await this.redisService.ttl(key);
	}

	/**
	 * Get all booking states for a user
	 * @returns Array of {flightInstanceId, state} pairs
	 */
	async findAllByUserId(userId: string): Promise<Array<{ flightInstanceId: string; state: BookingState }>> {
		const pattern = `${this.keyPrefix}:${userId}:*`;
		
		try {
			const keys = await this.redisService.keys(pattern);
			
			const results: Array<{ flightInstanceId: string; state: BookingState }> = [];
			for (const key of keys) {
				// Extract flightInstanceId from key: booking:state:{userId}:{flightInstanceId}
				const parts = key.split(':');
				if (parts.length >= 4) {
					const flightInstanceId = parts.slice(3).join(':'); // Handle UUID v7 format
					const state = await this.redisService.get<BookingState>(key);
					if (state) {
						results.push({ flightInstanceId, state });
					}
				}
			}

			this.logger.debug(`Found ${results.length} booking states for user: ${userId}`);
			return results;
		} catch (error) {
			this.logger.error(`Error finding all booking states for user: ${userId}`, error instanceof Error ? error.stack : '');
			return [];
		}
	}
}

