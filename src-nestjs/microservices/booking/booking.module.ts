import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Airport } from 'src/shared/entities/airport/airport.entity';
import { BookingPassenger } from 'src/shared/entities/booking/booking-passenger.entity';
import { BookingSegmentService } from 'src/shared/entities/booking/booking-segment-service.entity';
import { BookingSegment } from 'src/shared/entities/booking/booking-segment.entity';
import { Booking } from 'src/shared/entities/booking/booking.entity';
import { CabinService } from 'src/shared/entities/cabin/cabin-service.entity';
import { Currency } from 'src/shared/entities/currency/currency.entity';
import { FareClass } from 'src/shared/entities/fare/fare-class.entity';
import { FareDescriptionRule } from 'src/shared/entities/fare/fare-description-rule.entity';
import { RouteFarePrice } from 'src/shared/entities/fare/route-fare-price.entity';
import { FlightInstance } from 'src/shared/entities/flight/flight-instance.entity';
import { FlightSeat } from 'src/shared/entities/flight/flight-seat.entity';
import { Passenger } from 'src/shared/entities/passenger/passenger.entity';
import { Route } from 'src/shared/entities/route/route.entity';
import { Ticket } from 'src/shared/entities/ticket/ticket.entity';
import { User } from 'src/shared/entities/user/user.entity';
import { BookingStateModule } from 'src/shared/modules/booking-state/booking-state.module';
import { EmailClientModule } from 'src/shared/modules/email-client/email-client.module';
import { PassengerModule } from 'src/shared/modules/passenger/passenger.module';
import { RabbitMQModule } from 'src/shared/modules/rabbitmq/rabbitmq.module';
import { FarePricingService } from 'src/shared/services/fare-pricing.service';
import { EMAIL_MS } from '../email/email.messages';
import { RESERVATION_MS } from '../reservation/reservation.messages';
import { BookingMsController } from './booking.controller';
import { BookingService } from './booking.service';
import { TicketRabbitMQConsumer } from './consumers/ticket-rabbitmq.consumer';
import { BookingNotificationService } from './services/booking-notification.service';
import { TicketPdfService } from './services/ticket-pdf.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        TypeOrmModule.forFeature([
            Booking,
            BookingPassenger,
            BookingSegment,
            FlightInstance,
            FlightSeat,
            FareClass,
            Currency,
            Passenger,
            User,
            Ticket,
            Route,
            Airport,
            RouteFarePrice,
            FareDescriptionRule,
            BookingSegmentService,
            CabinService,
        ]),
        EmailClientModule, // Add Email Client module for sending email notifications
        RabbitMQModule, // Add RabbitMQ module for async messaging
        PassengerModule, // Add Passenger module for pricing and validation
        BookingStateModule, // Add BookingState module to get seats array
        ClientsModule.register([
            {
                name: 'RESERVATION_CLIENT',
                transport: Transport.TCP,
                options: {
                    host: RESERVATION_MS.TCP_HOST,
                    port: RESERVATION_MS.TCP_PORT,
                },
            },
            {
                name: 'EMAIL_CLIENT',
                transport: Transport.TCP,
                options: {
                    host: EMAIL_MS.TCP_HOST,
                    port: EMAIL_MS.TCP_PORT,
                },
            },
        ]),
    ],
    providers: [
        BookingService,
        BookingNotificationService,
        TicketPdfService,
        TicketRabbitMQConsumer,
        FarePricingService,
    ],
    controllers: [BookingMsController],
    exports: [BookingService],
})
export class BookingModule {}
