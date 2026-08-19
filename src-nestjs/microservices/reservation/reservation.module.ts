import { Module } from '@nestjs/common';
import { OutboxModule } from '../../../shared/modules/outbox/outbox.module';
import { CreateReservationHandler } from '../application/handlers/create-reservation.handler';
import { GetReservationHandler } from '../application/handlers/get-reservation.handler';
import { CancelReservationHandler } from '../application/handlers/cancel-reservation.handler';
import { ConvertToBookingHandler } from '../application/handlers/convert-to-booking.handler';
import { ExpireReservationScheduler } from '../application/handlers/expire-reservation.scheduler';
import { InMemoryReservationRepository } from '../domain/repositories/in-memory-reservation.repository';
import { ReservationMessageHandler } from '../interface/reservation.message-handler';

/**
 * ReservationModule — Wires the reservation bounded context.
 *
 * Old reservation.service.ts (686 lines) is replaced by 4 single-purpose handlers
 * + 1 cron scheduler.
 */
@Module({
    imports: [OutboxModule],
    controllers: [ReservationMessageHandler],
    providers: [
        CreateReservationHandler,
        GetReservationHandler,
        CancelReservationHandler,
        ConvertToBookingHandler,
        ExpireReservationScheduler,

        InMemoryReservationRepository,
        {
            provide: 'IReservationRepository',
            useExisting: InMemoryReservationRepository,
        },
    ],
    exports: ['IReservationRepository'],
})
export class ReservationModule {}