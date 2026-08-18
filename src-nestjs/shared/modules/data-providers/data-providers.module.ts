import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MockProvider } from './providers/mock.provider';
import { OurairportsProvider } from './providers/ourairports.provider';
import { DataService } from './services/data.service';
import { HttpClientService } from './services/http-client.service';
import { Airline } from '../../entities/airline/airline.entity';
import { AircraftType } from '../../entities/aircraft/aircraft-type.entity';
import { FlightInstance } from '../../entities/flight/flight-instance.entity';
import { Route } from '../../entities/route/route.entity';
import { RouteFarePrice } from '../../entities/fare/route-fare-price.entity';

@Global()
@Module({
    imports: [
        ConfigModule,
        TypeOrmModule.forFeature([
            Airline,
            AircraftType,
            FlightInstance,
            Route,
            RouteFarePrice,
        ]),
    ],
    providers: [HttpClientService, OurairportsProvider, MockProvider, DataService],
    exports: [DataService, OurairportsProvider, MockProvider, HttpClientService],
})
export class DataProvidersModule {}
