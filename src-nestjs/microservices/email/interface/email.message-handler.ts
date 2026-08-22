import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { QueueEmailHandler } from '../application/handlers/queue-email.handler';
import { SendEmailDirectHandler } from '../application/handlers/send-email-direct.handler';

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

    @MessagePattern('email.send')
    async queueEmail(payload: any): Promise<any> {
        return this.queueHandler.execute(payload);
    }

    @MessagePattern('email.send-direct')
    async sendEmailDirect(payload: any): Promise<any> {
        return this.sendDirectHandler.execute(payload);
    }
}
