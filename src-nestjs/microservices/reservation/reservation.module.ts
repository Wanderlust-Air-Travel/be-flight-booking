import { Module } from '@nestjs/common';
import { OutboxModule } from '../../shared/modules/outbox/outbox.module';
import { CancelReservationHandler } from './application/handlers/cancel-reservation.handler';
import { ConvertToBookingHandler } from './application/handlers/convert-to-booking.handler';
import { CreateReservationHandler } from './application/handlers/create-reservation.handler';
import { ExpireReservationScheduler } from './application/handlers/expire-reservation.scheduler';
import { GetReservationHandler } from './application/handlers/get-reservation.handler';
import { ReservationTypeOrmRepository } from './infrastructure/repositories/reservation.typeorm.repository';
import { ReservationMessageHandler } from './interface/reservation.message-handler';

/**
 * ReservationModule — Wires the reservation bounded context.
 *
 * IReservationRepository is bound to ReservationTypeOrmRepository, backed by
 * the SQL Server Reservations table via TypeORM DataSource.
 * IOutboxWriter comes from the @Global OutboxModule.
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

        // Repository: TypeORM-backed implementation
        ReservationTypeOrmRepository,
        {
            provide: 'IReservationRepository',
            useExisting: ReservationTypeOrmRepository,
        },
    ],
    exports: ['IReservationRepository'],
})
export class ReservationModule {}
