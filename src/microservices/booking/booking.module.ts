import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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

@Module({
	imports: [
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
	],
	providers: [BookingService],
	controllers: [BookingMsController],
	exports: [BookingService],
})
export class BookingModule {}

