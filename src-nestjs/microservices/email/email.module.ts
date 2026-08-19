import { Module } from '@nestjs/common';
import { OutboxModule } from '../../../shared/modules/outbox/outbox.module';
import { QueueEmailHandler } from '../application/handlers/queue-email.handler';
import { SendEmailDirectHandler } from '../application/handlers/send-email-direct.handler';
import { InMemoryEmailRepository } from '../domain/repositories/in-memory-email.repository';
import { EmailMessageHandler } from '../interface/email.message-handler';
import { EmailRequestedEventHandler } from '../application/event-handlers/email-requested.handler';

/**
 * EmailModule — Wires the email bounded context.
 *
 * Old email.service.ts is replaced by 2 handlers + 1 event handler.
 * Old email-rabbitmq.consumer.ts (raw amqplib) is replaced by
 * EmailRequestedEventHandler with @EventPattern.
 */
@Module({
    imports: [OutboxModule],
    controllers: [EmailMessageHandler, EmailRequestedEventHandler],
    providers: [
        QueueEmailHandler,
        SendEmailDirectHandler,

        InMemoryEmailRepository,
        {
            provide: 'IEmailMessageRepository',
            useExisting: InMemoryEmailRepository,
        },

        // Default no-op email sender (production would use Gmail/SMTP)
        {
            provide: 'IEmailSender',
            useValue: async () => {
                /* no-op: real sender injected at runtime */
            },
        },
    ],
    exports: ['IEmailMessageRepository'],
})
export class EmailModule {}