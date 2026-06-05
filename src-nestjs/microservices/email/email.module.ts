import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RabbitMQModule } from 'src/shared/modules/rabbitmq/rabbitmq.module';
import { EmailRabbitMQConsumer } from './consumers/email-rabbitmq.consumer';
import { EmailMsController } from './email.controller';
import { EmailService } from './email.service';
import { EmailQueueService } from './services/email-queue.service';
import { EmailTemplateService } from './services/email-template.service';
import { GmailApiService } from './services/gmail-api.service';

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
