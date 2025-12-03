import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Airport } from 'src/shared/entities/airport/airport.entity';
import { Route } from 'src/shared/entities/route/route.entity';
import { FlightSchedule } from 'src/shared/entities/flight/flight-schedule.entity';
import { FlightInstance } from 'src/shared/entities/flight/flight-instance.entity';
import { FlightSeat } from 'src/shared/entities/flight/flight-seat.entity';
import { FareClass } from 'src/shared/entities/fare/fare-class.entity';
import { CabinClass } from 'src/shared/entities/cabin/cabin-class.entity';
import { SeatConfiguration } from 'src/shared/entities/seat/seat-configuration.entity';
import { RouteFarePrice } from 'src/shared/entities/fare/route-fare-price.entity';
import { FarePricingService } from 'src/shared/services/fare-pricing.service';
import { SearchService } from './search.service';
import { SearchMsController } from './search.controller';

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
		]),
	],
	providers: [SearchService, FarePricingService],
	controllers: [SearchMsController],
	exports: [SearchService],
})
export class SearchModule {}