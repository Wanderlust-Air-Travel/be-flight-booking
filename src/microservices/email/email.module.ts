import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { EmailMsController } from './email.controller';
import { GmailApiService } from './services/gmail-api.service';
import { EmailQueueService } from './services/email-queue.service';
import { EmailTemplateService } from './services/email-template.service';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
		}),
	],
	providers: [EmailService, GmailApiService, EmailQueueService, EmailTemplateService],
	controllers: [EmailMsController],
	exports: [EmailService],
})
export class EmailModule {}

