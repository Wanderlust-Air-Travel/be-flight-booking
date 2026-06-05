import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FareClass } from 'src/shared/entities/fare/fare-class.entity';
import { FlightInstance } from 'src/shared/entities/flight/flight-instance.entity';
import { FlightSeat } from 'src/shared/entities/flight/flight-seat.entity';
import { BookingStateModule as SharedBookingStateModule } from 'src/shared/modules/booking-state/booking-state.module';
import { BookingStateController } from './booking-state.controller';

/**
 * API Gateway module for booking state endpoints
 * Uses shared BookingStateModule for business logic
 * Includes TypeORM repositories for seat validation
 */
@Module({
    imports: [
        SharedBookingStateModule,
        TypeOrmModule.forFeature([FlightSeat, FlightInstance, FareClass]),
    ],
    controllers: [BookingStateController],
})
export class BookingStateModule {}
