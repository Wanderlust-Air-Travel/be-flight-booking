import { Module } from '@nestjs/common';
import { BookingStateController } from './booking-state.controller';
import { BookingStateModule as SharedBookingStateModule } from 'src/shared/modules/booking-state/booking-state.module';

/**
 * API Gateway module for booking state endpoints
 * Uses shared BookingStateModule for business logic
 */
@Module({
	imports: [SharedBookingStateModule],
	controllers: [BookingStateController],
})
export class BookingStateModule {}

