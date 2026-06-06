import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Airport } from 'src/shared/entities/airport/airport.entity';
import { CabinClass } from 'src/shared/entities/cabin/cabin-class.entity';
import { FareClass } from 'src/shared/entities/fare/fare-class.entity';
import { FareDescriptionRule } from 'src/shared/entities/fare/fare-description-rule.entity';
import { RouteFarePrice } from 'src/shared/entities/fare/route-fare-price.entity';
import { FlightInstance } from 'src/shared/entities/flight/flight-instance.entity';
import { FlightSchedule } from 'src/shared/entities/flight/flight-schedule.entity';
import { FlightSeat } from 'src/shared/entities/flight/flight-seat.entity';
import { Route } from 'src/shared/entities/route/route.entity';
import { SeatConfiguration } from 'src/shared/entities/seat/seat-configuration.entity';
import { SearchMsController } from './search.controller';
import { SearchService } from './search.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Airport,
            Route,
            FlightSchedule,
            FlightInstance,
            FlightSeat,
            FareClass,
            CabinClass,
            SeatConfiguration,
            RouteFarePrice,
            FareDescriptionRule,
        ]),
    ],
    providers: [SearchService],
    controllers: [SearchMsController],
    exports: [SearchService],
})
export class SearchModule {}
