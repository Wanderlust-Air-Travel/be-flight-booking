import { Global, Module } from '@nestjs/common';
import { BookingStateRepository } from '../../repositories/booking-state.repository';
import { BookingStateService } from '../../services/booking-state.service';
import { RedisModule } from '../redis/redis.module';

/**
 * Global module for booking state management
 * Provides BookingStateService and BookingStateRepository
 * Can be imported by any module that needs booking state functionality
 */
@Global()
@Module({
    imports: [RedisModule],
    providers: [BookingStateRepository, BookingStateService],
    exports: [BookingStateRepository, BookingStateService],
})
export class BookingStateModule {}
