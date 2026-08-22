import { Module } from '@nestjs/common';
import { OutboxModule } from '../../shared/modules/outbox/outbox.module';
import { EmailRequestedEventHandler } from './application/event-handlers/email-requested.handler';
import { QueueEmailHandler } from './application/handlers/queue-email.handler';
import { SendEmailDirectHandler } from './application/handlers/send-email-direct.handler';
import { EmailMessageTypeOrmRepository } from './infrastructure/repositories/email-message.typeorm.repository';
import { EmailMessageHandler } from './interface/email.message-handler';

/**
 * EmailModule — Wires the email bounded context.
 *
 * IEmailMessageRepository is bound to EmailMessageTypeOrmRepository; the
 * IEmailSender stays as a no-op stub because there is no real transport
 * in development.
 *
 * IOutboxWriter comes from the @Global OutboxModule.
 */
@Module({
    imports: [OutboxModule],
    controllers: [EmailMessageHandler, EmailRequestedEventHandler],
    providers: [
        QueueEmailHandler,
        SendEmailDirectHandler,

        // Repository: TypeORM-backed implementation
        EmailMessageTypeOrmRepository,
        {
            provide: 'IEmailMessageRepository',
            useExisting: EmailMessageTypeOrmRepository,
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
