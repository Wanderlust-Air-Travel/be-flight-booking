import { Global, Module } from '@nestjs/common';
import { OutboxProcessor } from '../../infrastructure/messaging/outbox-processor';
import {
    DOMAIN_EVENT_PUBLISHER,
    RabbitMQEventBus,
} from '../../infrastructure/messaging/rabbitmq-event-bus';
import { OutboxModule } from '../outbox/outbox.module';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { RedisModule } from '../redis/redis.module';
import { RabbitMQPublisherService } from '../rabbitmq/rabbitmq-publisher.service';

/**
 * EventBusModule — Provides IDomainEventBus (RabbitMQEventBus) and the
 * OutboxProcessor (drains the outbox table on a schedule).
 *
 *  - IDomainEventBus → RabbitMQEventBus (uses RabbitMQPublisherService under the hood)
 *  - OutboxProcessor — wired with TypeOrmOutboxRepository + IDomainEventBus
 *
 * OutboxScheduler is intentionally NOT included here — the @Cron-driven
 * scheduler is wired separately at the bootstrap level (see api-gateway)
 * because it needs ScheduleModule.forRoot(). Microservices only need
 * the IOutboxWriter / IDomainEventBus pair, not the scheduler.
 *
 * Marked @Global so any microservice that imports the module can publish events.
 */
@Global()
@Module({
    imports: [OutboxModule, RabbitMQModule, RedisModule],
    providers: [
        RabbitMQPublisherService,
        {
            provide: DOMAIN_EVENT_PUBLISHER,
            useExisting: RabbitMQPublisherService,
        },
        RabbitMQEventBus,
        {
            provide: 'IDomainEventBus',
            useExisting: RabbitMQEventBus,
        },
        {
            provide: OutboxProcessor,
            inject: ['IOutboxRepository', 'IDomainEventBus'],
            useFactory: (repo: any, bus: any) =>
                new OutboxProcessor(repo, bus, { batchSize: 50, maxRetries: 5 }),
        },
    ],
    exports: ['IDomainEventBus', OutboxProcessor],
})
export class EventBusModule {}
