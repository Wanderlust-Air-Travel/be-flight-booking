import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { BookingStateStorageException } from '../exceptions/booking-state.exceptions';
import type { RedisService } from '../modules/redis/redis.service';
import type { BookingState } from '../types/booking-state.types';

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
        private readonly configService: ConfigService
    ) {
        const redisConfig = this.configService.get('redis');
        // State expires after the configured TTL from .env (REDIS_BOOKING_STATE_TTL)
        this.stateTtl = redisConfig?.ttl?.bookingState;
    }

    /**
     * Generate Redis key for booking state
     * Format: booking:state:{userId|sessionId}:{flightInstanceId}
     * For authenticated users: booking:state:{userId}:{flightInstanceId}
     * For guest users: booking:state:guest:{sessionId}:{flightInstanceId}
     */
    private generateKey(identifier: string, flightInstanceId: string, isGuest = false): string {
        if (isGuest) {
            return `${this.keyPrefix}:guest:${identifier}:${flightInstanceId}`;
        }
        return `${this.keyPrefix}:${identifier}:${flightInstanceId}`;
    }

    /**
     * Save booking state to Redis
     * @param identifier - User ID (authenticated) or session ID (guest)
     * @param flightInstanceId - Flight instance ID
     * @param state - Booking state to save
     * @param isGuest - Whether this is a guest session
     * @throws BookingStateStorageException if save fails
     */
    async save(
        identifier: string,
        flightInstanceId: string,
        state: BookingState,
        isGuest = false
    ): Promise<void> {
        const key = this.generateKey(identifier, flightInstanceId, isGuest);

        try {
            const saved = await this.redisService.set(key, state, this.stateTtl);

            if (!saved) {
                this.logger.error(`Failed to save booking state for key: ${key}`);
                throw new BookingStateStorageException(
                    'save',
                    `Redis SET operation returned false for key: ${key}`
                );
            }

            this.logger.debug(`Booking state saved successfully: ${key}`);
        } catch (error) {
            if (error instanceof BookingStateStorageException) {
                throw error;
            }
            this.logger.error(
                `Unexpected error saving booking state: ${error}`,
                error instanceof Error ? error.stack : ''
            );
            throw new BookingStateStorageException(
                'save',
                error instanceof Error ? error.message : String(error)
            );
        }
    }

    /**
     * Get booking state from Redis
     * @param identifier - User ID (authenticated) or session ID (guest)
     * @param flightInstanceId - Flight instance ID
     * @param isGuest - Whether this is a guest session
     * @returns BookingState or null if not found
     */
    async findOne(
        identifier: string,
        flightInstanceId: string,
        isGuest = false
    ): Promise<BookingState | null> {
        const key = this.generateKey(identifier, flightInstanceId, isGuest);

        try {
            const state = await this.redisService.get<BookingState>(key);
            return state;
        } catch (error) {
            this.logger.error(
                `Error retrieving booking state for key: ${key}`,
                error instanceof Error ? error.stack : ''
            );
            // Return null instead of throwing to allow graceful handling
            return null;
        }
    }

    /**
     * Delete booking state from Redis
     * @param identifier - User ID (authenticated) or session ID (guest)
     * @param flightInstanceId - Flight instance ID
     * @param isGuest - Whether this is a guest session
     * @returns true if deleted, false if not found
     */
    async delete(identifier: string, flightInstanceId: string, isGuest = false): Promise<boolean> {
        const key = this.generateKey(identifier, flightInstanceId, isGuest);

        try {
            const deleted = await this.redisService.del(key);
            if (deleted) {
                this.logger.debug(`Booking state deleted: ${key}`);
            }
            return deleted;
        } catch (error) {
            this.logger.error(
                `Error deleting booking state for key: ${key}`,
                error instanceof Error ? error.stack : ''
            );
            return false;
        }
    }

    /**
     * Delete all booking states for a user or guest session
     * @param identifier - User ID (authenticated) or session ID (guest)
     * @param isGuest - Whether this is a guest session
     * @returns number of deleted keys
     */
    async deleteAllByIdentifier(identifier: string, isGuest = false): Promise<number> {
        const pattern = isGuest
            ? `${this.keyPrefix}:guest:${identifier}:*`
            : `${this.keyPrefix}:${identifier}:*`;

        try {
            const keys = await this.redisService.keys(pattern);

            let deleted = 0;
            for (const key of keys) {
                if (await this.redisService.del(key)) {
                    deleted++;
                }
            }

            this.logger.debug(
                `Deleted ${deleted} booking states for ${isGuest ? 'guest session' : 'user'}: ${identifier}`
            );
            return deleted;
        } catch (error) {
            this.logger.error(
                `Error deleting all booking states for ${isGuest ? 'guest session' : 'user'}: ${identifier}`,
                error instanceof Error ? error.stack : ''
            );
            return 0;
        }
    }

    /**
     * Delete all booking states for a user (backward compatibility)
     * @returns number of deleted keys
     */
    async deleteAllByUserId(userId: string): Promise<number> {
        return this.deleteAllByIdentifier(userId, false);
    }

    /**
     * Check if booking state exists
     * @param identifier - User ID (authenticated) or session ID (guest)
     * @param flightInstanceId - Flight instance ID
     * @param isGuest - Whether this is a guest session
     */
    async exists(identifier: string, flightInstanceId: string, isGuest = false): Promise<boolean> {
        const key = this.generateKey(identifier, flightInstanceId, isGuest);
        return await this.redisService.exists(key);
    }

    /**
     * Get TTL for booking state
     * @param identifier - User ID (authenticated) or session ID (guest)
     * @param flightInstanceId - Flight instance ID
     * @param isGuest - Whether this is a guest session
     * @returns TTL in seconds, -1 if no TTL, -2 if key doesn't exist
     */
    async getTtl(identifier: string, flightInstanceId: string, isGuest = false): Promise<number> {
        const key = this.generateKey(identifier, flightInstanceId, isGuest);
        return await this.redisService.ttl(key);
    }

    /**
     * Get all booking states for a user or guest session
     * @param identifier - User ID (authenticated) or session ID (guest)
     * @param isGuest - Whether this is a guest session
     * @returns Array of {flightInstanceId, state} pairs
     */
    async findAllByIdentifier(
        identifier: string,
        isGuest = false
    ): Promise<Array<{ flightInstanceId: string; state: BookingState }>> {
        // Pattern should match: booking:state:{userId|guest:sessionId}:*
        // ioredis with keyPrefix 'flight-booking:' automatically prepends it to keys
        // But keys() pattern matching doesn't work correctly with keyPrefix, so we use raw Redis client
        // Actual key format in Redis: flight-booking:booking:state:{userId|guest:sessionId}:{flightInstanceId}
        const pattern = isGuest
            ? `${this.keyPrefix}:guest:${identifier}:*`
            : `${this.keyPrefix}:${identifier}:*`;
        const fullPattern = `flight-booking:${pattern}`;

        try {
            // Use raw Redis client to query keys because ioredis keyPrefix handling
            // doesn't work correctly with keys() pattern matching
            const rawRedis = this.redisService.getClient();
            const rawKeys = await rawRedis.keys(fullPattern);

            const results: Array<{ flightInstanceId: string; state: BookingState }> = [];
            for (const rawKey of rawKeys) {
                // Extract flightInstanceId from key: flight-booking:booking:state:{userId}:{flightInstanceId}
                // Remove the keyPrefix to get the relative key for redisService.get()
                const relativeKey = rawKey.replace(/^flight-booking:/, '');
                const parts = relativeKey.split(':');
                if (parts.length >= 4) {
                    const flightInstanceId = parts.slice(3).join(':'); // Handle UUID v7 format
                    const state = await this.redisService.get<BookingState>(relativeKey);
                    if (state) {
                        results.push({ flightInstanceId, state });
                    }
                }
            }

            this.logger.debug(
                `Found ${results.length} booking states for ${isGuest ? 'guest session' : 'user'}: ${identifier}`
            );
            return results;
        } catch (error) {
            this.logger.error(
                `Error finding all booking states for ${isGuest ? 'guest session' : 'user'}: ${identifier}`,
                error instanceof Error ? error.stack : ''
            );
            return [];
        }
    }

    /**
     * Get all booking states for a user (backward compatibility)
     * @returns Array of {flightInstanceId, state} pairs
     */
    async findAllByUserId(
        userId: string
    ): Promise<Array<{ flightInstanceId: string; state: BookingState }>> {
        return this.findAllByIdentifier(userId, false);
    }
}
