import { Controller, Logger } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { GetBookingHandler } from '../handlers/get-booking.handler';

/**
 * BookingCreatedNotificationHandler — Reacts to booking.created events
 * by emailing the customer with a confirmation.
 *
 * Sends through IDomainEventBus subscribers (email context picks up
 * via @EventPattern('booking.created')).
 *
 * Currently a no-op handler that just logs; in production this would
 * call a notification port or emit a downstream event.
 */
@Controller()
export class BookingCreatedNotificationHandler {
    private readonly logger = new Logger(BookingCreatedNotificationHandler.name);

    constructor(private readonly getBookingHandler: GetBookingHandler) {}

    @EventPattern('booking.created')
    async handle(payload: { bookingId: string }): Promise<void> {
        this.logger.log(`booking.created event received for ${payload.bookingId}`);
        // Real impl would call INofiticationPort.sendBookingConfirmation()
        // (implemented via outbox → consumer in email context)
    }
}
