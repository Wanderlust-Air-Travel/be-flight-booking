import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type Redis from 'ioredis';
import { RedisService } from 'src/shared/modules/redis/redis.service';
import { RealtimeService } from '../realtime.service';
import type { RealtimeGateway } from '../realtime.gateway';
import type { PaymentStatusMessage } from '../types/payment-status.types';

/**
 * Payment Status Service
 * High Priority: UX critical - immediate payment confirmation
 *
 * Architecture:
 * - Uses Redis Pub/Sub to broadcast payment status changes
 * - Payment service publishes status updates to Redis channel
 * - All clients subscribed to that booking receive real-time updates
 * - Supports both booking-level and payment-level subscriptions
 */
@Injectable()
export class PaymentStatusService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PaymentStatusService.name);
    private readonly redisSubscriber: Redis;
    private readonly bookingChannelPrefix = 'payment:status:booking:';
    private readonly paymentChannelPrefix = 'payment:status:payment:';
    private readonly subscribedChannels = new Set<string>();

    private get realtimeGateway(): RealtimeGateway | null {
        return this.realtimeService.getGateway() as RealtimeGateway | null;
    }

    constructor(
        private readonly realtimeService: RealtimeService,
        private readonly redisService: RedisService
    ) {
        const redisClient = this.redisService.getClient();
        this.redisSubscriber = redisClient.duplicate();
    }

    async onModuleInit() {
        // Subscribe to Redis pub/sub messages
        this.redisSubscriber.on('message', (channel, message) => {
            this.handleRedisMessage(channel, message);
        });

        this.redisSubscriber.on('pmessage', (_pattern, channel, message) => {
            this.handleRedisMessage(channel, message);
        });

        this.logger.log('Payment Status Service initialized');
    }

    async onModuleDestroy() {
        // Unsubscribe from all channels
        if (this.subscribedChannels.size > 0) {
            await this.redisSubscriber.unsubscribe(...Array.from(this.subscribedChannels));
        }
        await this.redisSubscriber.quit();
        this.logger.log('Payment Status Service destroyed');
    }

    /**
     * Subscribe a client to payment status updates for a booking
     */
    async subscribe(socketId: string, bookingId: string, paymentId?: string): Promise<void> {
        this.realtimeService.initializeClient(socketId);
        this.realtimeService.addSubscription(socketId, 'paymentStatus', bookingId);

        // Subscribe to booking-level channel
        const bookingChannel = this.getBookingChannel(bookingId);
        if (!this.subscribedChannels.has(bookingChannel)) {
            await this.redisSubscriber.subscribe(bookingChannel);
            this.subscribedChannels.add(bookingChannel);
            this.logger.log(`Subscribed to Redis channel: ${bookingChannel}`);
        }

        // If paymentId is provided, also subscribe to payment-specific channel
        if (paymentId) {
            const paymentChannel = this.getPaymentChannel(paymentId);
            if (!this.subscribedChannels.has(paymentChannel)) {
                await this.redisSubscriber.subscribe(paymentChannel);
                this.subscribedChannels.add(paymentChannel);
                this.logger.log(`Subscribed to Redis channel: ${paymentChannel}`);
            }
        }
    }

    /**
     * Unsubscribe a client from payment status updates
     */
    async unsubscribe(socketId: string, bookingId: string): Promise<void> {
        this.realtimeService.removeSubscription(socketId, 'paymentStatus', bookingId);

        // Check if any other clients are subscribed to this booking
        const subscribedClients = this.realtimeService.getSubscribedClients(
            'paymentStatus',
            bookingId
        );

        // If no clients are subscribed, unsubscribe from Redis channel
        if (subscribedClients.length === 0) {
            const bookingChannel = this.getBookingChannel(bookingId);
            await this.redisSubscriber.unsubscribe(bookingChannel);
            this.subscribedChannels.delete(bookingChannel);
            this.logger.log(`Unsubscribed from Redis channel: ${bookingChannel}`);
        }
    }

    /**
     * Publish payment status change to Redis
     * This should be called by Payment Service when payment status changes
     */
    async publishPaymentStatusChange(
        bookingId: string,
        paymentId: string,
        status: 'pending' | 'success' | 'failed',
        metadata?: Record<string, any>
    ): Promise<void> {
        const bookingChannel = this.getBookingChannel(bookingId);
        const paymentChannel = this.getPaymentChannel(paymentId);
        const redisClient = this.redisService.getClient();

        const message: PaymentStatusMessage = {
            bookingId,
            paymentId,
            status,
            timestamp: new Date().toISOString(),
            metadata,
        };

        // Publish to both booking and payment channels
        await redisClient.publish(bookingChannel, JSON.stringify(message));
        await redisClient.publish(paymentChannel, JSON.stringify(message));

        this.logger.debug(
            `Published payment status change: booking=${bookingId}, payment=${paymentId}, status=${status}`
        );
    }

    /**
     * Handle Redis pub/sub message
     */
    private handleRedisMessage(channel: string, message: string): void {
        try {
            const data: PaymentStatusMessage = JSON.parse(message);

            // Determine which booking this message is for
            let bookingId: string;
            if (channel.startsWith(this.bookingChannelPrefix)) {
                bookingId = channel.replace(this.bookingChannelPrefix, '');
            } else if (channel.startsWith(this.paymentChannelPrefix)) {
                // For payment-specific channel, use bookingId from message
                bookingId = data.bookingId;
            } else {
                this.logger.warn(`Unknown channel format: ${channel}`);
                return;
            }

            // Get all clients subscribed to this booking
            const subscribedClients = this.realtimeService.getSubscribedClients(
                'paymentStatus',
                bookingId
            );

            // Broadcast to all subscribed clients
            if (this.realtimeGateway) {
                const server = this.realtimeGateway.getServer();
                for (const socketId of subscribedClients) {
                    server.to(socketId).emit('payment-status:update', {
                        bookingId: data.bookingId,
                        paymentId: data.paymentId,
                        status: data.status,
                        timestamp: data.timestamp,
                        metadata: data.metadata,
                    });
                }
            } else {
                this.logger.warn('RealtimeGateway not available, cannot broadcast payment status update');
            }

            this.logger.debug(
                `Broadcasted payment status update to ${subscribedClients.length} clients for booking ${bookingId}`
            );
        } catch (error) {
            this.logger.error(`Error handling Redis message for channel ${channel}:`, error);
        }
    }

    /**
     * Get Redis channel name for a booking
     */
    private getBookingChannel(bookingId: string): string {
        return `${this.bookingChannelPrefix}${bookingId}`;
    }

    /**
     * Get Redis channel name for a payment
     */
    private getPaymentChannel(paymentId: string): string {
        return `${this.paymentChannelPrefix}${paymentId}`;
    }
}
