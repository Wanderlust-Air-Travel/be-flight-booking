import { Module } from '@nestjs/common';
import { TypeOrmModule, InjectRepository, getRepositoryToken } from '@nestjs/typeorm';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { BookingMessageHandler } from '../interface/booking.message-handler';
import { CreateBookingHandler } from '../application/handlers/create-booking.handler';
import { GetBookingHandler } from '../application/handlers/get-booking.handler';
import { CancelBookingHandler } from '../application/handlers/cancel-booking.handler';
import { CancelTicketHandler } from '../application/handlers/cancel-ticket.handler';
import { UpdateBookingPassengersHandler } from '../application/handlers/update-booking-passengers.handler';
import { CheckInBookingHandler } from '../application/handlers/check-in-booking.handler';
import { CreateTicketsFromBookingHandler } from '../application/handlers/create-tickets-from-booking.handler';
import { GetMyTicketsHandler } from '../application/handlers/get-my-tickets.handler';
import { GetMyJourneyHandler } from '../application/handlers/get-my-journey.handler';
import { PaymentSucceededHandler } from '../application/event-handlers/payment-succeeded.handler';
import { BookingCreatedNotificationHandler } from '../application/event-handlers/booking-created-notification.handler';
import { ReservationTcpAdapter } from '../infrastructure/adapters/reservation-tcp.adapter';
import { NotificationEventAdapter } from '../infrastructure/adapters/notification-event.adapter';
import { BookingInternalAdapter } from '../infrastructure/adapters/booking-internal.adapter';
import { InMemoryBookingRepository } from '../domain/repositories/in-memory-booking.repository';
import { OutboxModule } from '../../../shared/modules/outbox/outbox.module';

/**
 * BookingModule — Wires the booking bounded context.
 *
 * Provides all 9 use-case handlers, 3 port adapters, 2 event handlers,
 * and the message handler interface.
 *
 * Dependencies:
 *  - IBookingRepository: InMemoryBookingRepository for unit tests, BookingTypeOrmRepository for prod (TODO)
 *  - IReservationPort: ReservationTcpAdapter
 *  - INotificationPort: NotificationEventAdapter (via outbox)
 *  - IBookingPort: BookingInternalAdapter
 *  - IOutboxWriter: from @Global OutboxModule
 *
 * Old booking.service.ts (3966 lines) is replaced by these 9 single-purpose handlers.
 */
@Module({
    imports: [OutboxModule],
    controllers: [BookingMessageHandler, PaymentSucceededHandler, BookingCreatedNotificationHandler],
    providers: [
        // Use cases
        CreateBookingHandler,
        GetBookingHandler,
        CancelBookingHandler,
        CancelTicketHandler,
        UpdateBookingPassengersHandler,
        CheckInBookingHandler,
        CreateTicketsFromBookingHandler,
        GetMyTicketsHandler,
        GetMyJourneyHandler,

        // Repository: in-memory for now; phase 7 swaps in TypeORM adapter
        InMemoryBookingRepository,
        {
            provide: 'IBookingRepository',
            useExisting: InMemoryBookingRepository,
        },

        // Cross-context port adapters
        {
            provide: 'RESERVATION_CLIENT',
            useFactory: () =>
                ClientProxyFactory.create({
                    transport: Transport.TCP,
                    options: { host: 'localhost', port: 4002 },
                }),
        },
        {
            provide: 'IReservationPort',
            useClass: ReservationTcpAdapter,
        },
        {
            provide: 'INotificationPort',
            useClass: NotificationEventAdapter,
        },
        BookingInternalAdapter,
        {
            provide: 'IBookingPort',
            useExisting: BookingInternalAdapter,
        },
    ],
    exports: ['IBookingRepository', 'IBookingPort'],
})
export class BookingModule {}