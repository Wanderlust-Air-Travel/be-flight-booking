import { Injectable, Inject, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
	private readonly logger = new Logger(RedisService.name);

	constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {
		this.redis.on('connect', () => {
			this.logger.log('Redis connected');
		});

		this.redis.on('error', (error) => {
			this.logger.error('Redis error:', error);
		});
	}

	onModuleDestroy() {
		this.redis.disconnect();
	}

	/**
	 * Get value by key
	 */
	async get<T>(key: string): Promise<T | null> {
		try {
			const value = await this.redis.get(key);
			return value ? JSON.parse(value) : null;
		} catch (error) {
			this.logger.error(`Redis GET error for key ${key}:`, error);
			return null;
		}
	}

	/**
	 * Set value with optional TTL (Time To Live) in seconds
	 */
	async set(key: string, value: any, ttl?: number): Promise<boolean> {
		try {
			const serialized = JSON.stringify(value);
			if (ttl) {
				await this.redis.setex(key, ttl, serialized);
			} else {
				await this.redis.set(key, serialized);
			}
			return true;
		} catch (error) {
			this.logger.error(`Redis SET error for key ${key}:`, error);
			return false;
		}
	}

	/**
	 * Delete key
	 */
	async del(key: string): Promise<boolean> {
		try {
			const result = await this.redis.del(key);
			return result > 0;
		} catch (error) {
			this.logger.error(`Redis DEL error for key ${key}:`, error);
			return false;
		}
	}

	/**
	 * Check if key exists
	 */
	async exists(key: string): Promise<boolean> {
		try {
			const result = await this.redis.exists(key);
			return result === 1;
		} catch (error) {
			this.logger.error(`Redis EXISTS error for key ${key}:`, error);
			return false;
		}
	}

	/**
	 * Set TTL for existing key
	 */
	async expire(key: string, ttl: number): Promise<boolean> {
		try {
			const result = await this.redis.expire(key, ttl);
			return result === 1;
		} catch (error) {
			this.logger.error(`Redis EXPIRE error for key ${key}:`, error);
			return false;
		}
	}

	/**
	 * Get TTL for key (returns -1 if no TTL, -2 if key doesn't exist)
	 */
	async ttl(key: string): Promise<number> {
		try {
			return await this.redis.ttl(key);
		} catch (error) {
			this.logger.error(`Redis TTL error for key ${key}:`, error);
			return -2;
		}
	}

	/**
	 * Get all keys matching pattern
	 */
	async keys(pattern: string): Promise<string[]> {
		try {
			return await this.redis.keys(pattern);
		} catch (error) {
			this.logger.error(`Redis KEYS error for pattern ${pattern}:`, error);
			return [];
		}
	}

	/**
	 * Get raw Redis client (for advanced operations)
	 */
	getClient(): Redis {
		return this.redis;
	}
}

