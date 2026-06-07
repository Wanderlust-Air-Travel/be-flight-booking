import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { type Subscription, firstValueFrom, interval } from 'rxjs';
import { RealtimeService } from '../realtime.service';
import type { RealtimeGateway } from '../realtime.gateway';
import type {
    ReservationCountdownExpiredEvent,
    ReservationCountdownUpdateEvent,
} from '../types/reservation-countdown.types';

/**
 * Reservation Countdown Service
 * High Priority: Business critical - syncs countdown timer from server
 *
 * Architecture:
 * - Server is source of truth for reservation expiration time
 * - Periodically checks reservation TTL and broadcasts to subscribed clients
 * - Prevents client-side timer drift and ensures accuracy
 * - Broadcasts countdown updates every second for active reservations
 */
@Injectable()
export class ReservationCountdownService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(ReservationCountdownService.name);
    private readonly countdownIntervals = new Map<string, Subscription>();
    private readonly checkInterval = 1000;

    private get realtimeGateway(): RealtimeGateway | null {
        return this.realtimeService.getGateway() as RealtimeGateway | null;
    }

    private get reservationClient(): ClientProxy {
        return this._reservationClient;
    }

    constructor(
        private readonly realtimeService: RealtimeService,
        @Inject('RESERVATION_CLIENT') private readonly _reservationClient: ClientProxy
    ) {}

    async onModuleInit() {
        this.logger.log('Reservation Countdown Service initialized');
    }

    async onModuleDestroy() {
        // Clean up all intervals
        for (const [reservationId, subscription] of this.countdownIntervals.entries()) {
            subscription.unsubscribe();
            this.logger.debug(`Cleaned up countdown interval for reservation ${reservationId}`);
        }
        this.countdownIntervals.clear();
        this.logger.log('Reservation Countdown Service destroyed');
    }

    /**
     * Subscribe a client to reservation countdown updates
     */
    async subscribe(socketId: string, reservationId: string): Promise<void> {
        this.realtimeService.initializeClient(socketId);
        this.realtimeService.addSubscription(socketId, 'reservationCountdown', reservationId);

        // Start countdown interval if not already started
        if (!this.countdownIntervals.has(reservationId)) {
            this.startCountdown(reservationId);
        }
    }

    /**
     * Unsubscribe a client from reservation countdown updates
     */
    async unsubscribe(socketId: string, reservationId: string): Promise<void> {
        this.realtimeService.removeSubscription(socketId, 'reservationCountdown', reservationId);

        // Check if any other clients are subscribed
        const subscribedClients = this.realtimeService.getSubscribedClients(
            'reservationCountdown',
            reservationId
        );

        // If no clients are subscribed, stop the countdown interval
        if (subscribedClients.length === 0) {
            const subscription = this.countdownIntervals.get(reservationId);
            if (subscription) {
                subscription.unsubscribe();
                this.countdownIntervals.delete(reservationId);
                this.logger.debug(`Stopped countdown interval for reservation ${reservationId}`);
            }
        }
    }

    /**
     * Start countdown interval for a reservation
     */
    private startCountdown(reservationId: string): void {
        const subscription = interval(this.checkInterval).subscribe(async () => {
            try {
                // Get reservation from Reservation Service via TCP
                const reservation = await firstValueFrom(
                    this.reservationClient.send('reservation.get', reservationId)
                );

                if (!reservation) {
                    // Reservation not found, stop countdown
                    this.stopCountdown(reservationId);
                    return;
                }

                // Calculate remaining time
                const expiresAt = new Date(reservation.expiresAt);
                const now = new Date();
                const remainingSeconds = Math.max(
                    0,
                    Math.floor((expiresAt.getTime() - now.getTime()) / 1000)
                );

                // Get all subscribed clients
                const subscribedClients = this.realtimeService.getSubscribedClients(
                    'reservationCountdown',
                    reservationId
                );

                // Broadcast countdown update
                if (this.realtimeGateway) {
                    const server = this.realtimeGateway.getServer();
                    const updateEvent: ReservationCountdownUpdateEvent = {
                        reservationId,
                        remainingSeconds,
                        expiresAt: expiresAt.toISOString(),
                        isExpired: remainingSeconds === 0,
                    };
                    for (const socketId of subscribedClients) {
                        server.to(socketId).emit('reservation-countdown:update', updateEvent);
                    }
                } else {
                    this.logger.warn('RealtimeGateway not available, cannot broadcast countdown update');
                }

                // If expired, stop countdown
                if (remainingSeconds === 0) {
                    this.stopCountdown(reservationId);
                    // Notify clients that reservation expired
                    if (this.realtimeGateway) {
                        const expiredEvent: ReservationCountdownExpiredEvent = {
                            reservationId,
                            expiresAt: expiresAt.toISOString(),
                        };
                        for (const socketId of subscribedClients) {
                            this.realtimeGateway.getServer().to(socketId).emit('reservation-countdown:expired', expiredEvent);
                        }
                    }
                }
            } catch (error) {
                this.logger.error(
                    `Error updating countdown for reservation ${reservationId}:`,
                    error
                );
                // Stop countdown on error
                this.stopCountdown(reservationId);
            }
        });

        this.countdownIntervals.set(reservationId, subscription);
        this.logger.debug(`Started countdown interval for reservation ${reservationId}`);
    }

    /**
     * Stop countdown interval for a reservation
     */
    private stopCountdown(reservationId: string): void {
        const subscription = this.countdownIntervals.get(reservationId);
        if (subscription) {
            subscription.unsubscribe();
            this.countdownIntervals.delete(reservationId);
            this.logger.debug(`Stopped countdown interval for reservation ${reservationId}`);
        }
    }
}
