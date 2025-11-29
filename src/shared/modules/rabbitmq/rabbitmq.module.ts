import { Module, Global, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQService } from './rabbitmq.service';
import { RabbitMQPublisherService } from './rabbitmq-publisher.service';

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
 */
@Global()
@Module({
	imports: [ConfigModule],
	providers: [RabbitMQService, RabbitMQPublisherService],
	exports: [RabbitMQService, RabbitMQPublisherService],
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

