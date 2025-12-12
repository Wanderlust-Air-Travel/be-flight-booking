import { Module, Global, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQService } from './rabbitmq.service';
import { RabbitMQPublisherService } from './rabbitmq-publisher.service';
import { RabbitMQMonitoringService } from './rabbitmq-monitoring.service';
import { RedisModule } from '../redis/redis.module';
import { CommonModule } from '../common/common.module';

/**
 * RabbitMQ Module
 * 
 * Global module that provides RabbitMQ connection and messaging capabilities
 * to all microservices in the application.
 * 
 * Features:
 * - Connection pooling and management
 * - Automatic reconnection
 * - Queue and exchange declaration
 * - Publisher and consumer patterns
 * - Dead letter queue support
 * - Message deduplication (idempotency)
 * - Correlation IDs for tracing
 * - Message TTL and priority
 * - Monitoring and metrics
 */
@Global()
@Module({
	imports: [ConfigModule, RedisModule, CommonModule],
	providers: [RabbitMQService, RabbitMQPublisherService, RabbitMQMonitoringService],
	exports: [RabbitMQService, RabbitMQPublisherService, RabbitMQMonitoringService],
})
export class RabbitMQModule implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(RabbitMQModule.name);

	constructor(private readonly rabbitMQService: RabbitMQService) {}

	async onModuleInit() {
		await this.rabbitMQService.connect();
		this.logger.log('RabbitMQ module initialized');
	}

	async onModuleDestroy() {
		await this.rabbitMQService.disconnect();
		this.logger.log('RabbitMQ module destroyed');
	}
}

