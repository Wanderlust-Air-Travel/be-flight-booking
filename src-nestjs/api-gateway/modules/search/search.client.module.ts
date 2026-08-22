import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Airport } from 'src/api-gateway/data-access/entities/airport/airport.entity';
import { CabinClass } from 'src/api-gateway/data-access/entities/cabin/cabin-class.entity';
import { CabinService } from 'src/api-gateway/data-access/entities/cabin/cabin-service.entity';
import { BaggageAllowance } from 'src/api-gateway/data-access/entities/fare/baggage-allowance.entity';
import { FareClass } from 'src/api-gateway/data-access/entities/fare/fare-class.entity';
import { FareDescriptionRule } from 'src/api-gateway/data-access/entities/fare/fare-description-rule.entity';
import { RouteFarePrice } from 'src/api-gateway/data-access/entities/fare/route-fare-price.entity';
import { FlightInstance } from 'src/api-gateway/data-access/entities/flight/flight-instance.entity';
import { SEARCH_MS } from 'src/microservices/search/search.messages';
import { CabinServiceService } from 'src/shared/services/cabin-service.service';
import { FareOptionService } from 'src/shared/services/fare-option.service';
import { AuthModule } from '../auth/auth.module';
import { BookingStateModule } from '../booking-state/booking-state.module';
import { SearchController } from './search.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Airport,
            CabinService,
            CabinClass,
            FareClass,
            FareDescriptionRule,
            BaggageAllowance,
            RouteFarePrice,
            FlightInstance,
        ]),
        ClientsModule.register([
            {
                name: 'SEARCH_CLIENT',
                transport: Transport.TCP,
                options: {
                    host: SEARCH_MS.TCP_PEER_HOST,
                    port: SEARCH_MS.TCP_PORT,
                    heartbeatInterval: 5000,
                    heartbeatTimeout: 15000,
                },
            },
        ]),
        BookingStateModule,
        AuthModule, // Import AuthModule to use OptionalJwtAuthGuard
    ],
    controllers: [SearchController],
    providers: [CabinServiceService, FareOptionService],
    exports: [CabinServiceService, FareOptionService],
})
export class SearchClientModule {}
