import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AircraftType } from 'src/api-gateway/data-access/entities/aircraft/aircraft-type.entity';
import { Airline } from 'src/api-gateway/data-access/entities/airline/airline.entity';
import { RouteFarePrice } from 'src/api-gateway/data-access/entities/fare/route-fare-price.entity';
import { FlightInstance } from 'src/api-gateway/data-access/entities/flight/flight-instance.entity';
import { Route } from 'src/api-gateway/data-access/entities/route/route.entity';
import { MockProvider } from './providers/mock.provider';
import { OurairportsProvider } from './providers/ourairports.provider';
import { DataService } from './services/data.service';
import { HttpClientService } from './services/http-client.service';

const isDev = process.env.NODE_ENV !== 'production';

@Global()
@Module({
    imports: [
        ConfigModule,
        TypeOrmModule.forFeature([Airline, AircraftType, FlightInstance, Route, RouteFarePrice]),
    ],
    providers: [
        HttpClientService,
        OurairportsProvider,
        ...(isDev ? [MockProvider] : []),
        DataService,
    ],
    exports: [DataService, OurairportsProvider, ...(isDev ? [MockProvider] : []), HttpClientService],
})
export class DataProvidersModule {}
