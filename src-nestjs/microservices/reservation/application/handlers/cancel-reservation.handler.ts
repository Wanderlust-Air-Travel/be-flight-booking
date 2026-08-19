import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IReservationRepository } from '../../domain/repositories/reservation.repository.interface';
import type { IOutboxWriter } from '../../../../../shared/application/ports/outbox-writer.interface';

export interface CancelReservationCommand {
    reservationId: string;
    userId: string;
    reason: string;
}

export interface CancelReservationResponse {
    reservationId: string;
    status: string;
    cancelledAt: string;
}

@Injectable()
export class CancelReservationHandler {
    constructor(
        @Inject('IReservationRepository') private readonly repo: IReservationRepository,
        @Inject('IOutboxWriter') private readonly outbox: IOutboxWriter
    ) {}

    async execute(command: CancelReservationCommand): Promise<CancelReservationResponse> {
        const reservation = await this.repo.findById(command.reservationId);
        if (!reservation) throw new NotFoundException(`Reservation ${command.reservationId} not found`);
        if (reservation.userId !== command.userId) {
            // Allow system-initiated cancel (userId = 'system') for cleanup
            if (command.userId !== 'system') {
                throw new NotFoundException(`Reservation not accessible`);
            }
        }

        reservation.cancel(command.userId, command.reason);
        await this.repo.save(reservation);
        for (const event of reservation.pullDomainEvents()) {
            await this.outbox.append(event);
        }

        return {
            reservationId: reservation.id,
            status: reservation.status.value,
            cancelledAt: new Date().toISOString(),
        };
    }
}