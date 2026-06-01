import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { FlightInstance } from 'src/shared/entities/flight/flight-instance.entity';
import { FlightSeat } from 'src/shared/entities/flight/flight-seat.entity';
import { FareClass } from 'src/shared/entities/fare/fare-class.entity';
import { Currency } from 'src/shared/entities/currency/currency.entity';
import { Reservation } from 'src/shared/entities/reservation/reservation.entity';
import { RouteFarePrice } from 'src/shared/entities/fare/route-fare-price.entity';
import { Route } from 'src/shared/entities/route/route.entity';
import { FarePricingService } from 'src/shared/services/fare-pricing.service';
import { BookingStateModule } from 'src/shared/modules/booking-state/booking-state.module';
import { ReservationService } from './reservation.service';
import { ReservationMsController } from './reservation.controller';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
		}),
		TypeOrmModule.forFeature([FlightInstance, FlightSeat, FareClass, Currency, Reservation, RouteFarePrice, Route]),
		BookingStateModule,
	],
	providers: [ReservationService, FarePricingService],
	controllers: [ReservationMsController],
	exports: [ReservationService],
})
export class ReservationModule {}

