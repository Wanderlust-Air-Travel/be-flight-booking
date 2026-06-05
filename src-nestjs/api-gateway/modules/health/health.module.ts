import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { RedisModule } from 'src/shared/modules/redis/redis.module';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './redis-health.indicator';

@Module({
    imports: [TerminusModule, HttpModule, RedisModule],
    controllers: [HealthController],
    providers: [RedisHealthIndicator],
})
export class HealthModule {}
