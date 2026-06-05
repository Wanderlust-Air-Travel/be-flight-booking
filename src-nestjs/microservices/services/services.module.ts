import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingSegment } from 'src/shared/entities/booking/booking-segment.entity';
import { RouteFarePrice } from 'src/shared/entities/fare/route-fare-price.entity';
import { FlightInstance } from 'src/shared/entities/flight/flight-instance.entity';
import { FlightSchedule } from 'src/shared/entities/flight/flight-schedule.entity';
import { FlightSeat } from 'src/shared/entities/flight/flight-seat.entity';
import { Route } from 'src/shared/entities/route/route.entity';
import { ServicesMsController } from './services.controller';
import { ServicesService } from './services.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Route,
            FlightInstance,
            FlightSchedule,
            FlightSeat,
            BookingSegment,
            RouteFarePrice,
        ]),
    ],
    providers: [ServicesService],
    controllers: [ServicesMsController],
    exports: [ServicesService],
})
export class ServicesModule {}
