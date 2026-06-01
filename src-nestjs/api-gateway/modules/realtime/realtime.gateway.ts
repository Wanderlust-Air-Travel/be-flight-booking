import {
	WebSocketGateway,
	WebSocketServer,
	SubscribeMessage,
	OnGatewayConnection,
	OnGatewayDisconnect,
	ConnectedSocket,
	MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, Inject, forwardRef } from '@nestjs/common';
import { RealtimeService } from './realtime.service';
import { SeatAvailabilityService } from './services/seat-availability.service';
import { ReservationCountdownService } from './services/reservation-countdown.service';
import { PaymentStatusService } from './services/payment-status.service';
import { OptionalJwtAuthGuard } from '../auth/guard/optional-jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WebSocketConnectionInfo } from './types/realtime.types';

/**
 * WebSocket Gateway for real-time communication
 * Handles client connections and routes events to appropriate services
 */
@WebSocketGateway({
	cors: {
		origin: process.env.FRONTEND_URL || '*',
		credentials: true,
	},
	namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
	@WebSocketServer()
	server: Server;

	private readonly logger = new Logger(RealtimeGateway.name);
	private readonly connectedClients = new Map<string, WebSocketConnectionInfo<Socket>>();

	constructor(
		private readonly realtimeService: RealtimeService,
		@Inject(forwardRef(() => SeatAvailabilityService))
		private readonly seatAvailabilityService: SeatAvailabilityService,
		@Inject(forwardRef(() => ReservationCountdownService))
		private readonly reservationCountdownService: ReservationCountdownService,
		@Inject(forwardRef(() => PaymentStatusService))
		private readonly paymentStatusService: PaymentStatusService,
		private readonly jwtService: JwtService,
		private readonly configService: ConfigService,
	) {}

	/**
	 * Handle client connection
	 * Authenticate user (JWT or session ID) and register client
	 */
	async handleConnection(client: Socket) {
		try {
			const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
			const sessionId = client.handshake.auth?.sessionId || client.handshake.query?.sessionId as string;

			let userId: string | undefined;
			let authenticated = false;

			// Try JWT authentication first
			if (token) {
				try {
					const payload = await this.jwtService.verifyAsync(token, {
						secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
					});
					userId = payload.sub || payload.userId;
					authenticated = true;
					this.logger.log(`Authenticated WebSocket connection: userId=${userId}, socketId=${client.id}`);
				} catch (error) {
					this.logger.warn(`JWT verification failed for socket ${client.id}: ${error.message}`);
				}
			}

			// For guest users, use session ID
			if (!authenticated && sessionId) {
				this.logger.log(`Guest WebSocket connection: sessionId=${sessionId}, socketId=${client.id}`);
			}

			// Register client
			this.connectedClients.set(client.id, {
				socket: client,
				userId,
				sessionId: authenticated ? undefined : sessionId,
			});

			// Join user-specific room for targeted messaging
			if (userId) {
				client.join(`user:${userId}`);
			}
			if (sessionId) {
				client.join(`session:${sessionId}`);
			}

			client.emit('connected', {
				success: true,
				socketId: client.id,
				userId,
				sessionId: authenticated ? undefined : sessionId,
			});
		} catch (error) {
			this.logger.error(`Error handling connection for socket ${client.id}:`, error);
			client.emit('error', { message: 'Connection failed' });
			client.disconnect();
		}
	}

	/**
	 * Handle client disconnection
	 * Clean up subscriptions and unregister client
	 */
	async handleDisconnect(client: Socket) {
		const clientInfo = this.connectedClients.get(client.id);
		if (clientInfo) {
			// Unsubscribe from all services
			await this.realtimeService.unsubscribeAll(client.id);
			this.connectedClients.delete(client.id);
			this.logger.log(`Client disconnected: socketId=${client.id}`);
		}
	}

	/**
	 * Subscribe to seat availability updates for a flight
	 * High Priority: Prevents seat selection conflicts
	 */
	@SubscribeMessage('subscribe:seat-availability')
	async handleSeatAvailabilitySubscribe(
		@ConnectedSocket() client: Socket,
		@MessageBody() data: { flightInstanceId: string },
	) {
		try {
			const clientInfo = this.connectedClients.get(client.id);
			if (!clientInfo) {
				client.emit('error', { message: 'Client not authenticated' });
				return;
			}

			await this.seatAvailabilityService.subscribe(client.id, data.flightInstanceId);
			client.emit('subscribed:seat-availability', {
				success: true,
				flightInstanceId: data.flightInstanceId,
			});

			this.logger.log(
				`Client ${client.id} subscribed to seat availability for flight ${data.flightInstanceId}`,
			);
		} catch (error) {
			this.logger.error(`Error subscribing to seat availability:`, error);
			client.emit('error', { message: 'Failed to subscribe to seat availability' });
		}
	}

	/**
	 * Unsubscribe from seat availability updates
	 */
	@SubscribeMessage('unsubscribe:seat-availability')
	async handleSeatAvailabilityUnsubscribe(
		@ConnectedSocket() client: Socket,
		@MessageBody() data: { flightInstanceId: string },
	) {
		try {
			await this.seatAvailabilityService.unsubscribe(client.id, data.flightInstanceId);
			client.emit('unsubscribed:seat-availability', {
				success: true,
				flightInstanceId: data.flightInstanceId,
			});
		} catch (error) {
			this.logger.error(`Error unsubscribing from seat availability:`, error);
		}
	}

	/**
	 * Subscribe to reservation countdown timer
	 * High Priority: Business critical - syncs countdown from server
	 */
	@SubscribeMessage('subscribe:reservation-countdown')
	async handleReservationCountdownSubscribe(
		@ConnectedSocket() client: Socket,
		@MessageBody() data: { reservationId: string },
	) {
		try {
			const clientInfo = this.connectedClients.get(client.id);
			if (!clientInfo) {
				client.emit('error', { message: 'Client not authenticated' });
				return;
			}

			await this.reservationCountdownService.subscribe(client.id, data.reservationId);
			client.emit('subscribed:reservation-countdown', {
				success: true,
				reservationId: data.reservationId,
			});

			this.logger.log(
				`Client ${client.id} subscribed to reservation countdown for ${data.reservationId}`,
			);
		} catch (error) {
			this.logger.error(`Error subscribing to reservation countdown:`, error);
			client.emit('error', { message: 'Failed to subscribe to reservation countdown' });
		}
	}

	/**
	 * Unsubscribe from reservation countdown
	 */
	@SubscribeMessage('unsubscribe:reservation-countdown')
	async handleReservationCountdownUnsubscribe(
		@ConnectedSocket() client: Socket,
		@MessageBody() data: { reservationId: string },
	) {
		try {
			await this.reservationCountdownService.unsubscribe(client.id, data.reservationId);
			client.emit('unsubscribed:reservation-countdown', {
				success: true,
				reservationId: data.reservationId,
			});
		} catch (error) {
			this.logger.error(`Error unsubscribing from reservation countdown:`, error);
		}
	}

	/**
	 * Subscribe to payment status updates
	 * High Priority: UX critical - immediate payment confirmation
	 */
	@SubscribeMessage('subscribe:payment-status')
	async handlePaymentStatusSubscribe(
		@ConnectedSocket() client: Socket,
		@MessageBody() data: { bookingId: string; paymentId?: string },
	) {
		try {
			const clientInfo = this.connectedClients.get(client.id);
			if (!clientInfo) {
				client.emit('error', { message: 'Client not authenticated' });
				return;
			}

			await this.paymentStatusService.subscribe(client.id, data.bookingId, data.paymentId);
			client.emit('subscribed:payment-status', {
				success: true,
				bookingId: data.bookingId,
				paymentId: data.paymentId,
			});

			this.logger.log(
				`Client ${client.id} subscribed to payment status for booking ${data.bookingId}`,
			);
		} catch (error) {
			this.logger.error(`Error subscribing to payment status:`, error);
			client.emit('error', { message: 'Failed to subscribe to payment status' });
		}
	}

	/**
	 * Unsubscribe from payment status
	 */
	@SubscribeMessage('unsubscribe:payment-status')
	async handlePaymentStatusUnsubscribe(
		@ConnectedSocket() client: Socket,
		@MessageBody() data: { bookingId: string },
	) {
		try {
			await this.paymentStatusService.unsubscribe(client.id, data.bookingId);
			client.emit('unsubscribed:payment-status', {
				success: true,
				bookingId: data.bookingId,
			});
		} catch (error) {
			this.logger.error(`Error unsubscribing from payment status:`, error);
		}
	}

	/**
	 * Get server instance for broadcasting from services
	 */
	getServer(): Server {
		return this.server;
	}

	/**
	 * Get client info by socket ID
	 */
	getClientInfo(socketId: string) {
		return this.connectedClients.get(socketId);
	}
}

