import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { SeatAvailabilityService } from './services/seat-availability.service';
import { ReservationCountdownService } from './services/reservation-countdown.service';
import { PaymentStatusService } from './services/payment-status.service';
import { RedisModule } from 'src/shared/modules/redis/redis.module';
import { BookingStateModule } from '../booking-state/booking-state.module';
import { ReservationClientModule } from '../reservation/reservation.client.module';
import { PaymentClientModule } from '../payment/payment.client.module';
import { AuthModule } from '../auth/auth.module';
import { RESERVATION_MS } from 'src/microservices/reservation/reservation.messages';

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
		ReservationClientModule,
		PaymentClientModule,
		AuthModule,
		// Register RESERVATION_CLIENT for ReservationCountdownService
		ClientsModule.register([
			{
				name: 'RESERVATION_CLIENT',
				transport: Transport.TCP,
				options: {
					host: RESERVATION_MS.TCP_HOST,
					port: RESERVATION_MS.TCP_PORT,
				},
			},
		]),
	],
	providers: [
		RealtimeGateway,
		RealtimeService,
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

