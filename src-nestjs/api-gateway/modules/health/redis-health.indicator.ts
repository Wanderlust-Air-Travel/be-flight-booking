import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, type HealthIndicatorResult } from '@nestjs/terminus';
import type { RedisService } from 'src/shared/modules/redis/redis.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
    constructor(private readonly redisService: RedisService) {
        super();
    }

    async pingCheck(key: string): Promise<HealthIndicatorResult> {
        try {
            const client = this.redisService.getClient();
            await client.ping();
            return this.getStatus(key, true);
        } catch (error) {
            throw new HealthCheckError(
                'Redis check failed',
                this.getStatus(key, false, { message: error.message })
            );
        }
    }
}
