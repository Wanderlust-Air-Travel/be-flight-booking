import { Inject, Injectable, Logger } from '@nestjs/common';
import type { IReservationRepository } from '../../domain/repositories/reservation.repository.interface';
import type { IOutboxWriter } from '../../../../../shared/application/ports/outbox-writer.interface';
import { Reservation } from '../../domain/aggregates/reservation.aggregate';

export interface CreateReservationCommand {
    userId: string | null;
    contactEmail: string;
    segments: Array<{
        flightInstanceId: string;
        fareClassCode: string;
        cabinType: string;
        passengerCount: number;
    }>;
    ttlMinutes: number;
}

export interface CreateReservationResponse {
    reservationId: string;
    status: string;
    expiresAt: string;
    contactEmail: string;
}

@Injectable()
export class CreateReservationHandler {
    private readonly logger = new Logger(CreateReservationHandler.name);

    constructor(
        @Inject('IReservationRepository') private readonly repo: IReservationRepository,
        @Inject('IOutboxWriter') private readonly outbox: IOutboxWriter
    ) {}

    async execute(command: CreateReservationCommand): Promise<CreateReservationResponse> {
        const reservation = Reservation.create(command);
        await this.repo.save(reservation);
        for (const event of reservation.pullDomainEvents()) {
            await this.outbox.append(event);
        }
        return {
            reservationId: reservation.id,
            status: reservation.status.value,
            expiresAt: reservation.expiresAt.toISOString(),
            contactEmail: reservation.contactEmail,
        };
    }
}