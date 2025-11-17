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
import { BookingService } from './booking.service';
import { BookingMsController } from './booking.controller';
import { RESERVATION_MS } from '../reservation/reservation.messages';

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
		]),
		ClientsModule.register([
			{
				name: 'RESERVATION_CLIENT',
				transport: Transport.TCP,
				options: {
					host: RESERVATION_MS.TCP_HOST,
					port: RESERVATION_MS.TCP_PORT,
				},
			},
		]),
	],
	providers: [BookingService],
	controllers: [BookingMsController],
	exports: [BookingService],
})
export class BookingModule {}

