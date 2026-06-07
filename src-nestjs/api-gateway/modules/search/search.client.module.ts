import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SEARCH_MS } from 'src/microservices/search/search.messages';
import { CabinService } from 'src/shared/entities/cabin/cabin-service.entity';
import { BaggageAllowance } from 'src/shared/entities/fare/baggage-allowance.entity';
import { CabinServiceService } from 'src/shared/services/cabin-service.service';
import { AuthModule } from '../auth/auth.module';
import { BookingStateModule } from '../booking-state/booking-state.module';
import { SearchController } from './search.controller';

@Module({
    imports: [
        ClientsModule.register([
            {
                name: 'SEARCH_CLIENT',
                transport: Transport.TCP,
                options: {
                    host: SEARCH_MS.TCP_HOST,
                    port: SEARCH_MS.TCP_PORT,
                    heartbeatInterval: 5000,
                    heartbeatTimeout: 15000,
                },
            },
        ]),
        TypeOrmModule.forFeature([CabinService, BaggageAllowance]),
        BookingStateModule,
        AuthModule, // Import AuthModule to use OptionalJwtAuthGuard
    ],
    controllers: [SearchController],
    providers: [CabinServiceService],
    exports: [CabinServiceService],
})
export class SearchClientModule {}
