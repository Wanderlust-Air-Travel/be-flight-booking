import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IReservationRepository } from '../../domain/repositories/reservation.repository.interface';

export interface GetReservationQuery {
    reservationId: string;
}

export interface GetReservationResponse {
    reservationId: string;
    userId: string | null;
    contactEmail: string;
    status: string;
    expiresAt: string;
    bookingId: string | null;
    segments: Array<{
        flightInstanceId: string;
        fareClassCode: string;
        cabinType: string;
        passengerCount: number;
    }>;
}

@Injectable()
export class GetReservationHandler {
    constructor(
        @Inject('IReservationRepository') private readonly repo: IReservationRepository
    ) {}

    async execute(query: GetReservationQuery): Promise<GetReservationResponse> {
        const r = await this.repo.findById(query.reservationId);
        if (!r) throw new NotFoundException(`Reservation ${query.reservationId} not found`);
        return {
            reservationId: r.id,
            userId: r.userId,
            contactEmail: r.contactEmail,
            status: r.status.value,
            expiresAt: r.expiresAt.toISOString(),
            bookingId: r.bookingId,
            segments: r.segments.map((s) => ({
                flightInstanceId: s.flightInstanceId,
                fareClassCode: s.fareClassCode,
                cabinType: s.cabinType,
                passengerCount: s.passengerCount,
            })),
        };
    }
}