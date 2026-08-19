import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IReservationRepository } from '../../domain/repositories/reservation.repository.interface';
import type { IOutboxWriter } from '../../../../../shared/application/ports/outbox-writer.interface';

export interface ConvertToBookingCommand {
    reservationId: string;
    bookingId: string;
}

export interface ConvertToBookingResponse {
    reservationId: string;
    bookingId: string;
    convertedAt: string;
}

@Injectable()
export class ConvertToBookingHandler {
    constructor(
        @Inject('IReservationRepository') private readonly repo: IReservationRepository,
        @Inject('IOutboxWriter') private readonly outbox: IOutboxWriter
    ) {}

    async execute(command: ConvertToBookingCommand): Promise<ConvertToBookingResponse> {
        const reservation = await this.repo.findById(command.reservationId);
        if (!reservation) throw new NotFoundException(`Reservation ${command.reservationId} not found`);

        reservation.convertToBooking(command.bookingId);
        await this.repo.save(reservation);
        for (const event of reservation.pullDomainEvents()) {
            await this.outbox.append(event);
        }

        return {
            reservationId: reservation.id,
            bookingId: command.bookingId,
            convertedAt: new Date().toISOString(),
        };
    }
}