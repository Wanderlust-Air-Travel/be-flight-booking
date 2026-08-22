import { Controller, Inject, Logger } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import type { IOutboxWriter } from '../../../../shared/application/ports/outbox-writer.interface';
import { EmailFailedEvent, EmailSentEvent } from '../../domain/events/email.events';
import type { IEmailMessageRepository } from '../../domain/repositories/email.repository.interface';

/**
 * EmailRequestedEventHandler — Reacts to `email.requested` events.
 *
 * Picks up the email from the repository, calls the external email
 * service (Gmail API/SMTP), and emits EmailSentEvent or EmailFailedEvent.
 *
 * Replaces the old raw amqplib consumer.
 */
@Controller()
export class EmailRequestedEventHandler {
    private readonly logger = new Logger(EmailRequestedEventHandler.name);

    constructor(
        @Inject('IEmailMessageRepository') private readonly emailRepo: IEmailMessageRepository,
        @Inject('IOutboxWriter') private readonly outbox: IOutboxWriter,
        @Inject('IEmailSender') private readonly emailSender: (to: string, subject: string, body: string) => Promise<void>
    ) {}

    @EventPattern('email.requested')
    async handle(payload: { emailMessageId: string }): Promise<void> {
        const message = await this.emailRepo.findById(payload.emailMessageId);
        if (!message) {
            this.logger.warn(`Email ${payload.emailMessageId} not found`);
            return;
        }
        try {
            await this.emailSender(message.to, message.subject, message.body);
            message.markSent(new Date());
            await this.emailRepo.save(message);
            await this.outbox.append(new EmailSentEvent(message.id, message.sentAt!));
        } catch (error: any) {
            message.markFailed(error.message);
            await this.emailRepo.save(message);
            await this.outbox.append(
                new EmailFailedEvent(message.id, error.message, message.attempts)
            );
        }
    }
}
