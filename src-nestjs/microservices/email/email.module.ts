import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { EmailMsController } from './email.controller';
import { GmailApiService } from './services/gmail-api.service';
import { EmailQueueService } from './services/email-queue.service';
import { EmailTemplateService } from './services/email-template.service';
import { RabbitMQModule } from 'src/shared/modules/rabbitmq/rabbitmq.module';
import { EmailRabbitMQConsumer } from './consumers/email-rabbitmq.consumer';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
		}),
		RabbitMQModule, // Add RabbitMQ module for async messaging
	],
	providers: [
		EmailService,
		GmailApiService,
		EmailQueueService,
		EmailTemplateService,
		EmailRabbitMQConsumer, // Add RabbitMQ consumer
	],
	controllers: [EmailMsController],
	exports: [EmailService],
})
export class EmailModule {}

