import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Airport } from 'src/domain/airport/entity/airport.entity';
import { Route } from 'src/domain/route/entity/route.entity';
import { FlightSchedule } from 'src/domain/flight/entity/flight-schedule.entity';
import { FlightInstance } from 'src/domain/flight/entity/flight-instance.entity';
import { FlightSeat } from 'src/domain/flight/entity/flight-seat.entity';
import { SearchService } from './search.service';
import { SearchMsController } from './search.controller';

@Module({
	imports: [
		TypeOrmModule.forFeature([Airport, Route, FlightSchedule, FlightInstance, FlightSeat]),
	],
	providers: [SearchService],
	controllers: [SearchMsController],
	exports: [SearchService],
})
export class SearchModule {}


