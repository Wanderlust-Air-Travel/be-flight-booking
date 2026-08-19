import { Controller, Logger } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { CreateTicketsFromBookingHandler } from '../handlers/create-tickets-from-booking.handler';

/**
 * PaymentSucceededHandler — Listens for payment.succeeded events from the
 * payment context and dispatches a CreateTicketsFromBooking command.
 *
 * Replaces the old `consumers/ticket-rabbitmq.consumer.ts` (raw amqplib).
 * Uses @EventPattern for proper NestJS subscription.
 */
@Controller()
export class PaymentSucceededHandler {
    private readonly logger = new Logger(PaymentSucceededHandler.name);

    constructor(
        private readonly createTicketsHandler: CreateTicketsFromBookingHandler
    ) {}

    @EventPattern('payment.succeeded')
    async handlePaymentSucceeded(payload: {
        bookingId: string;
        ticketCount: number;
    }): Promise<void> {
        this.logger.log(
            `Received payment.succeeded for booking ${payload.bookingId}`
        );
        try {
            await this.createTicketsHandler.execute({
                bookingId: payload.bookingId,
                ticketCount: payload.ticketCount ?? 1,
            });
            this.logger.log(
                `Created tickets for booking ${payload.bookingId} after payment.succeeded`
            );
        } catch (error: any) {
            // Idempotency: if tickets already issued, this is fine.
            // Other errors are logged so the consumer doesn't retry indefinitely.
            this.logger.error(
                `Failed to create tickets for booking ${payload.bookingId}: ${error.message}`
            );
        }
    }
}