import { Global, Module } from '@nestjs/common';
import { IDomainEventBus } from '../../application/ports/domain-event-bus.interface';
import {
    DOMAIN_EVENT_PUBLISHER,
    RabbitMQEventBus,
} from '../../infrastructure/messaging/rabbitmq-event-bus';
import { RabbitMQPublisherService } from '../rabbitmq/rabbitmq-publisher.service';
import { OutboxModule } from '../outbox/outbox.module';
import { OutboxProcessor } from '../../infrastructure/messaging/outbox-processor';
import { OutboxScheduler } from './outbox.scheduler';

/**
 * EventBusModule — Provides IDomainEventBus (RabbitMQEventBus) and the
 * OutboxProcessor (drains the outbox table on a schedule).
 *
 *  - IDomainEventBus → RabbitMQEventBus (uses RabbitMQPublisherService under the hood)
 *  - OutboxProcessor — wired with TypeOrmOutboxRepository + IDomainEventBus
 *  - OutboxScheduler — invokes processor every 5 seconds via @Cron
 *
 * Marked @Global so any microservice that imports the module can publish events.
 */
@Global()
@Module({
    imports: [OutboxModule],
    providers: [
        {
            provide: DOMAIN_EVENT_PUBLISHER,
            useExisting: RabbitMQPublisherService,
        },
        {
            provide: 'IDomainEventBus',
            useClass: RabbitMQEventBus,
        },
        {
            provide: OutboxProcessor,
            inject: ['IOutboxRepository', 'IDomainEventBus'],
            useFactory: (repo: any, bus: any) =>
                new OutboxProcessor(repo, bus, { batchSize: 50, maxRetries: 5 }),
        },
        OutboxScheduler,
    ],
    exports: ['IDomainEventBus', OutboxProcessor],
})
export class EventBusModule {}