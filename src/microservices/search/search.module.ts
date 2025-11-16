import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Airport } from 'src/shared/entities/airport/airport.entity';
import { Route } from 'src/shared/entities/route/route.entity';
import { FlightSchedule } from 'src/shared/entities/flight/flight-schedule.entity';
import { FlightInstance } from 'src/shared/entities/flight/flight-instance.entity';
import { FlightSeat } from 'src/shared/entities/flight/flight-seat.entity';
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