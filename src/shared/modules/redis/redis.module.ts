import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import redisConfig from 'src/shared/config/redis.config';
import { RedisService } from './redis.service';

@Global()
@Module({
	imports: [ConfigModule.forFeature(redisConfig)],
	providers: [
		{
			provide: 'REDIS_CLIENT',
			useFactory: (configService: ConfigService) => {
				const config = configService.get('redis');
				return new Redis({
					host: config.host,
					port: config.port,
					password: config.password,
					db: config.db,
					keyPrefix: config.keyPrefix,
					retryStrategy: (times) => {
						const delay = Math.min(times * 50, 2000);
						return delay;
					},
					maxRetriesPerRequest: 3,
				});
			},
			inject: [ConfigService],
		},
		RedisService,
	],
	exports: ['REDIS_CLIENT', RedisService],
})
export class RedisModule {}

