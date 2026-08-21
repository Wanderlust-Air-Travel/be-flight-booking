import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RESERVATION_MS } from 'src/microservices/reservation/reservation.messages';
import { RedisModule } from 'src/shared/modules/redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { BookingStateModule } from '../booking-state/booking-state.module';
import { PaymentClientModule } from '../payment/payment.client.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { PaymentStatusService } from './services/payment-status.service';
import { ReservationCountdownService } from './services/reservation-countdown.service';
import { SeatAvailabilityService } from './services/seat-availability.service';

/**
 * Real-time WebSocket Module
 * Handles real-time updates for:
 * - Seat availability (High priority)
 * - Reservation countdown timer (High priority)
 * - Payment status (High priority)
 * - Flight status updates (Medium priority)
 * - Price changes (Medium priority)
 * - Inventory sync (Medium priority)
 */
@Module({
    imports: [
        RedisModule,
        BookingStateModule,
        PaymentClientModule,
        AuthModule,
        // Register RESERVATION_CLIENT for ReservationCountdownService
        ClientsModule.register([
            {
                name: 'RESERVATION_CLIENT',
                transport: Transport.TCP,
                options: {
                    host: RESERVATION_MS.TCP_PEER_HOST,
                    port: RESERVATION_MS.TCP_PORT,
                },
            },
        ]),
    ],
    providers: [
        RealtimeService,
        RealtimeGateway, // Put gateway first to ensure it's initialized before services that depend on it
        SeatAvailabilityService,
        ReservationCountdownService,
        PaymentStatusService,
    ],
    exports: [
        RealtimeGateway,
        RealtimeService,
        SeatAvailabilityService,
        ReservationCountdownService,
        PaymentStatusService,
    ],
})
export class RealtimeModule {}
