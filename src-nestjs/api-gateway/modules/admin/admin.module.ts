import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { FareClass } from 'src/shared/entities/fare/fare-class.entity';
import { CabinClass } from 'src/shared/entities/cabin/cabin-class.entity';
import { FlightSchedule } from 'src/shared/entities/flight/flight-schedule.entity';
import { FlightInstance } from 'src/shared/entities/flight/flight-instance.entity';
import { Route } from 'src/shared/entities/route/route.entity';
import { AircraftType } from 'src/shared/entities/aircraft/aircraft-type.entity';
import { Aircraft } from 'src/shared/entities/aircraft/aircraft.entity';
import { FlightSeat } from 'src/shared/entities/flight/flight-seat.entity';
import { SeatConfiguration } from 'src/shared/entities/seat/seat-configuration.entity';
import { User } from 'src/shared/entities/user/user.entity';
import { UserRole } from 'src/shared/entities/user/user-role.entity';
import { Role } from 'src/shared/entities/role/role.entity';
import { RouteFarePrice } from 'src/shared/entities/fare/route-fare-price.entity';
import { BaggageAllowance } from 'src/shared/entities/fare/baggage-allowance.entity';
import { CabinService } from 'src/shared/entities/cabin/cabin-service.entity';
import { FareDescriptionRule } from 'src/shared/entities/fare/fare-description-rule.entity';
import { RolesGuard } from 'src/shared/guards/roles.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			FareClass,
			CabinClass,
			FlightSchedule,
			FlightInstance,
			Route,
			AircraftType,
			Aircraft,
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

