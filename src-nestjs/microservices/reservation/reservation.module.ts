import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Currency } from 'src/shared/entities/currency/currency.entity';
import { FareClass } from 'src/shared/entities/fare/fare-class.entity';
import { RouteFarePrice } from 'src/shared/entities/fare/route-fare-price.entity';
import { FlightInstance } from 'src/shared/entities/flight/flight-instance.entity';
import { FlightSeat } from 'src/shared/entities/flight/flight-seat.entity';
import { Reservation } from 'src/shared/entities/reservation/reservation.entity';
import { Route } from 'src/shared/entities/route/route.entity';
import { BookingStateModule } from 'src/shared/modules/booking-state/booking-state.module';
import { FarePricingService } from 'src/shared/services/fare-pricing.service';
import { ReservationMsController } from './reservation.controller';
import { ReservationService } from './reservation.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        TypeOrmModule.forFeature([
            FlightInstance,
            FlightSeat,
            FareClass,
            Currency,
            Reservation,
            RouteFarePrice,
            Route,
        ]),
        BookingStateModule,
    ],
    providers: [ReservationService, FarePricingService],
    controllers: [ReservationMsController],
    exports: [ReservationService],
})
export class ReservationModule {}
