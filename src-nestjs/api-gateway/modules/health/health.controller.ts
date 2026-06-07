import { Controller, Get } from '@nestjs/common';
import {
    DiskHealthIndicator,
    HealthCheck,
    HealthCheckService,
    MemoryHealthIndicator,
    TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis-health.indicator';

@Controller('health')
export class HealthController {
    constructor(
        private readonly health: HealthCheckService,
        private readonly db: TypeOrmHealthIndicator,
        private readonly memory: MemoryHealthIndicator,
        private readonly disk: DiskHealthIndicator,
        private readonly redis: RedisHealthIndicator
    ) {}

    @Get()
    @HealthCheck()
    check() {
        return this.health.check([
            () => this.db.pingCheck('database'),
            () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024), // 150MB
            // Increased threshold for RSS to avoid false positives in test environment
            () => this.memory.checkRSS('memory_rss', 1024 * 1024 * 1024), // 1GB
            () => this.redis.pingCheck('redis'),
        ]);
    }

    @Get('readiness')
    @HealthCheck()
    readiness() {
        return this.health.check([
            () => this.db.pingCheck('database'),
            () => this.redis.pingCheck('redis'),
        ]);
    }

    @Get('liveness')
    liveness() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        };
    }
}
