import { Injectable, Logger } from '@nestjs/common';
import type { IDomainEventBus } from '../../../../../shared/application/ports/domain-event-bus.interface';
import type {
    INotificationPort,
    BookingNotificationInput,
    BookingCancellationInput,
} from '../../application/ports/notification.port';

/**
 * NotificationEventAdapter — Event-based adapter for INotificationPort.
 *
 * Translates notifications into domain events on the message bus,
 * allowing the email context to consume them asynchronously.
 * Replaces synchronous TCP fallback with proper EDA.
 */
@Injectable()
export class NotificationEventAdapter implements INotificationPort {
    private readonly logger = new Logger(NotificationEventAdapter.name);

    constructor(private readonly eventBus: IDomainEventBus) {}

    async sendBookingConfirmation(input: BookingNotificationInput): Promise<void> {
        await this.eventBus.publish({
            eventId: crypto.randomUUID(),
            aggregateId: input.bookingId,
            occurredAt: new Date(),
            eventName: 'notification.booking_confirmation_requested',
            version: 1,
            payload: input,
        } as any);
    }

    async sendBookingCancellation(input: BookingCancellationInput): Promise<void> {
        await this.eventBus.publish({
            eventId: crypto.randomUUID(),
            aggregateId: input.bookingId,
            occurredAt: new Date(),
            eventName: 'notification.booking_cancellation_requested',
            version: 1,
            payload: input,
        } as any);
    }
}