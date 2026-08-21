import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AircraftType } from 'src/api-gateway/data-access/entities/aircraft/aircraft-type.entity';
import { Aircraft } from 'src/api-gateway/data-access/entities/aircraft/aircraft.entity';
import { Airline } from 'src/api-gateway/data-access/entities/airline/airline.entity';
import { Airport } from 'src/api-gateway/data-access/entities/airport/airport.entity';
import { CabinClass } from 'src/api-gateway/data-access/entities/cabin/cabin-class.entity';
import { CabinService } from 'src/api-gateway/data-access/entities/cabin/cabin-service.entity';
import { BaggageAllowance } from 'src/api-gateway/data-access/entities/fare/baggage-allowance.entity';
import { FareClass } from 'src/api-gateway/data-access/entities/fare/fare-class.entity';
import { FareDescriptionRule } from 'src/api-gateway/data-access/entities/fare/fare-description-rule.entity';
import { RouteFarePrice } from 'src/api-gateway/data-access/entities/fare/route-fare-price.entity';
import { FlightInstance } from 'src/api-gateway/data-access/entities/flight/flight-instance.entity';
import { FlightSchedule } from 'src/api-gateway/data-access/entities/flight/flight-schedule.entity';
import { FlightSeat } from 'src/api-gateway/data-access/entities/flight/flight-seat.entity';
import { Role } from 'src/api-gateway/data-access/entities/role/role.entity';
import { Route } from 'src/api-gateway/data-access/entities/route/route.entity';
import { SeatConfiguration } from 'src/api-gateway/data-access/entities/seat/seat-configuration.entity';
import { UserRole } from 'src/api-gateway/data-access/entities/user/user-role.entity';
import { User } from 'src/api-gateway/data-access/entities/user/user.entity';
import { RolesGuard } from 'src/shared/guards/roles.guard';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            FareClass,
            CabinClass,
            FlightSchedule,
            FlightInstance,
            Route,
            Airport,
            AircraftType,
            Aircraft,
            Airline,
            FlightSeat,
            SeatConfiguration,
            User,
            UserRole,
            Role,
            RouteFarePrice,
            BaggageAllowance,
            CabinService,
            FareDescriptionRule,
        ]),
        AuthModule,
    ],
    controllers: [AdminController],
    providers: [AdminService, RolesGuard],
    exports: [AdminService],
})
export class AdminModule {}
