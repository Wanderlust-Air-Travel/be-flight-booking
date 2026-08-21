import { Inject, Injectable } from '@nestjs/common';
import type { IDomainEventBus } from '../../application/ports/domain-event-bus.interface';
import type { IDomainEvent } from '../../domain/events/domain-event';

/**
 * Token for injecting the underlying publisher (e.g. RabbitMQPublisherService).
 * Using a symbol lets us avoid a hard class-to-class import in this module,
 * which keeps the adapter unit-testable without loading uuid / amqplib at
 * test time.
 */
export const DOMAIN_EVENT_PUBLISHER = Symbol('DOMAIN_EVENT_PUBLISHER');

export interface IDomainEventPublisher {
    publishEvent(
        routingKey: string,
        event: unknown,
        options?: { correlationId?: string; priority?: number }
    ): Promise<boolean>;
}

export interface PublishOptions {
    correlationId?: string;
}

/**
 * RabbitMQEventBus — Production implementation of IDomainEventBus.
 *
 * Wraps the underlying publisher (RabbitMQPublisherService) and translates
 * domain events into topic-exchange publishes with routing key =
 * event.eventName(). Consumers subscribe via `@EventPattern(routingKey)` on
 * the `flight_booking_events` exchange.
 *
 * The publisher is injected via the DOMAIN_EVENT_PUBLISHER symbol to keep
 * this module free of transitive deps on uuid/amqplib for unit tests.
 */
@Injectable()
export class RabbitMQEventBus implements IDomainEventBus {
    constructor(
        @Inject(DOMAIN_EVENT_PUBLISHER) private readonly publisher: IDomainEventPublisher
    ) {}

    async publish(event: IDomainEvent, options?: PublishOptions): Promise<void> {
        await this.publisher.publishEvent(event.eventName, event, {
            correlationId: options?.correlationId,
        });
    }

    async publishAll(events: readonly IDomainEvent[], options?: PublishOptions): Promise<void> {
        for (const event of events) {
            await this.publish(event, options);
        }
    }
}
