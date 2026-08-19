import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import type { IReservationPort, ReservationSummary } from '../../application/ports/reservation.port';

/**
 * ReservationTcpAdapter — Production adapter for IReservationPort.
 * Wraps the existing RESERVATION_CLIENT (NestJS TCP microservice client).
 *
 * For now this is a thin passthrough; in Phase 8 it can be converted to
 * subscribe to events instead of synchronous calls.
 */
@Injectable()
export class ReservationTcpAdapter implements IReservationPort {
    private readonly logger = new Logger(ReservationTcpAdapter.name);

    constructor(
        @Inject('RESERVATION_CLIENT') private readonly client: ClientProxy
    ) {}

    async findById(reservationId: string): Promise<ReservationSummary | null> {
        try {
            return await this.client
                .send<ReservationSummary | null>('find_reservation_by_id', { reservationId })
                .toPromise();
        } catch (error: any) {
            this.logger.warn(`findById failed: ${error.message}`);
            return null;
        }
    }

    async cancel(reservationId: string, by: string): Promise<void> {
        await this.client
            .send<void>('cancel_reservation', { reservationId, by })
            .toPromise();
    }
}