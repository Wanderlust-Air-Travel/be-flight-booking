import { Inject, Injectable, Logger } from '@nestjs/common';
import type { IOutboxWriter } from '../../../../shared/application/ports/outbox-writer.interface';
import { EmailMessage, type EmailTemplate } from '../../domain/aggregates/email-message.aggregate';
import { EmailRequestedEvent } from '../../domain/events/email.events';
import type { IEmailMessageRepository } from '../../domain/repositories/email.repository.interface';

export interface QueueEmailCommand {
    to: string;
    subject: string;
    body: string;
    template: EmailTemplate;
}

export interface QueueEmailResponse {
    emailId: string;
    status: string;
    queuedAt: string;
}

/**
 * QueueEmailHandler — Application handler for sending an email.
 *
 * Creates EmailMessage aggregate, persists, emits EmailRequestedEvent.
 * The actual Gmail/SMTP send happens via the @EventPattern listener
 * (EmailRequestedEventHandler) which calls an external email service.
 *
 * Replaces the old `email-rabbitmq.consumer.ts` raw amqplib consumer.
 */
@Injectable()
export class QueueEmailHandler {
    private readonly logger = new Logger(QueueEmailHandler.name);

    constructor(
        @Inject('IEmailMessageRepository') private readonly repo: IEmailMessageRepository,
        @Inject('IOutboxWriter') private readonly outbox: IOutboxWriter
    ) {}

    async execute(command: QueueEmailCommand): Promise<QueueEmailResponse> {
        const message = EmailMessage.create({
            to: command.to,
            subject: command.subject,
            body: command.body,
            template: command.template,
        });
        await this.repo.save(message);

        for (const event of message.pullDomainEvents()) {
            await this.outbox.append(event);
        }

        // Also emit a Requested event so an event handler can deliver it.
        await this.outbox.append(new EmailRequestedEvent(message.id, message.to, message.template));

        return {
            emailId: message.id,
            status: message.status,
            queuedAt: message.createdAt.toISOString(),
        };
    }
}
