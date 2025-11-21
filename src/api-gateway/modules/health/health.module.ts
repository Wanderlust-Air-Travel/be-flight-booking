import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { RedisModule } from 'src/shared/modules/redis/redis.module';

@Module({
	imports: [TerminusModule, HttpModule, RedisModule],
	controllers: [HealthController],
})
export class HealthModule {}

