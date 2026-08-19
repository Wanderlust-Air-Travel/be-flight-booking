import { Body, Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { CreateBookingHandler } from '../../application/handlers/create-booking.handler';
import { GetBookingHandler } from '../../application/handlers/get-booking.handler';
import { CancelBookingHandler } from '../../application/handlers/cancel-booking.handler';
import { CancelTicketHandler } from '../../application/handlers/cancel-ticket.handler';
import { UpdateBookingPassengersHandler } from '../../application/handlers/update-booking-passengers.handler';
import { CheckInBookingHandler } from '../../application/handlers/check-in-booking.handler';
import { CreateTicketsFromBookingHandler } from '../../application/handlers/create-tickets-from-booking.handler';
import { GetMyTicketsHandler } from '../../application/handlers/get-my-tickets.handler';
import { GetMyJourneyHandler } from '../../application/handlers/get-my-journey.handler';
import { Money } from '../../domain/value-objects/money';
import { ContactInfo } from '../../domain/value-objects/contact-info';

/**
 * BookingMessageHandler — Thin interface layer. Translates TCP messages
 * to commands and dispatches to the appropriate application handler.
 *
 * Replaces `booking.controller.ts` (the original was 275 lines of inline logic).
 */
@Controller()
export class BookingMessageHandler {
    constructor(
        private readonly createBookingHandler: CreateBookingHandler,
        private readonly getBookingHandler: GetBookingHandler,
        private readonly cancelBookingHandler: CancelBookingHandler,
        private readonly cancelTicketHandler: CancelTicketHandler,
        private readonly updatePassengersHandler: UpdateBookingPassengersHandler,
        private readonly checkInBookingHandler: CheckInBookingHandler,
        private readonly createTicketsHandler: CreateTicketsFromBookingHandler,
        private readonly getMyTicketsHandler: GetMyTicketsHandler,
        private readonly getMyJourneyHandler: GetMyJourneyHandler
    ) {}

    @MessagePattern('create_booking')
    async createBooking(payload: any): Promise<any> {
        return this.createBookingHandler.execute({
            contact: ContactInfo.create(
                payload.contactFullName,
                payload.contactEmail,
                payload.contactPhone
            ),
            totalAmount: Money.create(payload.totalAmount, payload.currency),
            passengers: payload.passengers,
            segments: payload.segments,
            userId: payload.userId ?? null,
        });
    }

    @MessagePattern('get_booking')
    async getBooking(payload: { bookingId: string; userId: string | null }): Promise<any> {
        return this.getBookingHandler.execute(payload);
    }

    @MessagePattern('cancel_booking')
    async cancelBooking(payload: any): Promise<any> {
        return this.cancelBookingHandler.execute({
            bookingId: payload.bookingId,
            userId: payload.userId,
            reason: payload.reason ?? 'unspecified',
        });
    }

    @MessagePattern('cancel_ticket')
    async cancelTicket(payload: any): Promise<any> {
        return this.cancelTicketHandler.execute({
            bookingId: payload.bookingId,
            userId: payload.userId,
            ticketIndex: payload.ticketIndex ?? 0,
            reason: payload.reason ?? 'unspecified',
        });
    }

    @MessagePattern('update_booking_passengers')
    async updatePassengers(payload: any): Promise<any> {
        return this.updatePassengersHandler.execute({
            bookingId: payload.bookingId,
            userId: payload.userId,
            passengers: payload.passengers,
        });
    }

    @MessagePattern('check_in_booking')
    async checkInBooking(payload: any): Promise<any> {
        return this.checkInBookingHandler.execute({
            bookingId: payload.bookingId,
            userId: payload.userId,
            checkedInAt: new Date(payload.checkedInAt ?? Date.now()),
        });
    }

    @MessagePattern('create_tickets_from_booking')
    async createTickets(payload: any): Promise<any> {
        return this.createTicketsHandler.execute({
            bookingId: payload.bookingId,
            ticketCount: payload.ticketCount ?? 1,
        });
    }

    @MessagePattern('get_my_tickets')
    async getMyTickets(payload: any): Promise<any> {
        return this.getMyTicketsHandler.execute({
            userId: payload.userId,
            page: payload.page ?? 1,
            limit: payload.limit ?? 10,
        });
    }

    @MessagePattern('get_my_journey')
    async getMyJourney(payload: any): Promise<any> {
        return this.getMyJourneyHandler.execute({ userId: payload.userId });
    }
}