import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import type { CancelReservationHandler } from '../application/handlers/cancel-reservation.handler';
import type { ConvertToBookingHandler } from '../application/handlers/convert-to-booking.handler';
import type { CreateReservationHandler } from '../application/handlers/create-reservation.handler';
import type { GetReservationHandler } from '../application/handlers/get-reservation.handler';

/**
 * ReservationMessageHandler — Thin interface for reservation context.
 * Replaces the old 686-line reservation.service.ts.
 */
@Controller()
export class ReservationMessageHandler {
    constructor(
        private readonly createHandler: CreateReservationHandler,
        private readonly getHandler: GetReservationHandler,
        private readonly cancelHandler: CancelReservationHandler,
        private readonly convertHandler: ConvertToBookingHandler
    ) {}

    @MessagePattern('create_reservation')
    async create(payload: any): Promise<any> {
        return this.createHandler.execute(payload);
    }

    @MessagePattern('get_reservation')
    async get(payload: { reservationId: string }): Promise<any> {
        return this.getHandler.execute(payload);
    }

    @MessagePattern('cancel_reservation')
    async cancel(payload: any): Promise<any> {
        return this.cancelHandler.execute(payload);
    }

    @MessagePattern('convert_reservation_to_booking')
    async convert(payload: any): Promise<any> {
        return this.convertHandler.execute({
            reservationId: payload.reservationId,
            bookingId: payload.bookingId,
        });
    }
}
