import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Booking } from 'src/shared/entities/booking/booking.entity';
import { BookingPassenger } from 'src/shared/entities/booking/booking-passenger.entity';
import { BookingSegment } from 'src/shared/entities/booking/booking-segment.entity';
import { FlightInstance } from 'src/shared/entities/flight/flight-instance.entity';
import { FlightSeat } from 'src/shared/entities/flight/flight-seat.entity';
import { FareClass } from 'src/shared/entities/fare/fare-class.entity';
import { Currency } from 'src/shared/entities/currency/currency.entity';
import { Passenger } from 'src/shared/entities/passenger/passenger.entity';
import { User } from 'src/shared/entities/user/user.entity';
import { Ticket } from 'src/shared/entities/ticket/ticket.entity';
import { Route } from 'src/shared/entities/route/route.entity';
import { Airport } from 'src/shared/entities/airport/airport.entity';
import { EmailClientModule } from 'src/shared/modules/email-client/email-client.module';
import { RabbitMQModule } from 'src/shared/modules/rabbitmq/rabbitmq.module';
import { PassengerModule } from 'src/shared/modules/passenger/passenger.module';
import { BookingService } from './booking.service';
import { BookingMsController } from './booking.controller';
import { BookingNotificationService } from './services/booking-notification.service';
import { TicketRabbitMQConsumer } from './consumers/ticket-rabbitmq.consumer';
import { RESERVATION_MS } from '../reservation/reservation.messages';
import { EMAIL_MS } from '../email/email.messages';

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
		]),
		EmailClientModule, // Add Email Client module for sending email notifications
		RabbitMQModule, // Add RabbitMQ module for async messaging
		PassengerModule, // Add Passenger module for pricing and validation
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
	providers: [BookingService, BookingNotificationService, TicketRabbitMQConsumer],
	controllers: [BookingMsController],
	exports: [BookingService],
})
export class BookingModule {}

