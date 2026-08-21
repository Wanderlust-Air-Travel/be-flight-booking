import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import type { QueueEmailHandler } from '../application/handlers/queue-email.handler';
import type { SendEmailDirectHandler } from '../application/handlers/send-email-direct.handler';

/**
 * EmailMessageHandler — Thin interface for email context.
 * Replaces the old email.service.ts.
 */
@Controller()
export class EmailMessageHandler {
    constructor(
        private readonly queueHandler: QueueEmailHandler,
        private readonly sendDirectHandler: SendEmailDirectHandler
    ) {}

    @MessagePattern('queue_email')
    async queueEmail(payload: any): Promise<any> {
        return this.queueHandler.execute(payload);
    }

    @MessagePattern('send_email_direct')
    async sendEmailDirect(payload: any): Promise<any> {
        return this.sendDirectHandler.execute(payload);
    }
}
