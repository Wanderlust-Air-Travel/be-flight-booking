import { Injectable, Logger } from '@nestjs/common';
import { SubscriptionType, ClientSubscriptions } from './types/realtime.types';

/**
 * Central service for managing real-time subscriptions
 * Tracks all active subscriptions per client
 */
@Injectable()
export class RealtimeService {
	private readonly logger = new Logger(RealtimeService.name);
	private readonly subscriptions = new Map<string, ClientSubscriptions>();

	/**
	 * Initialize subscriptions for a client
	 */
	initializeClient(socketId: string): void {
		if (!this.subscriptions.has(socketId)) {
			this.subscriptions.set(socketId, {
				seatAvailability: new Set(),
				reservationCountdown: new Set(),
				paymentStatus: new Set(),
			});
		}
	}

	/**
	 * Add subscription
	 */
	addSubscription(socketId: string, type: SubscriptionType, resourceId: string): void {
		this.initializeClient(socketId);
		const clientSubs = this.subscriptions.get(socketId)!;
		clientSubs[type].add(resourceId);
		this.logger.debug(`Added subscription: ${socketId} -> ${type}:${resourceId}`);
	}

	/**
	 * Remove subscription
	 */
	removeSubscription(socketId: string, type: SubscriptionType, resourceId: string): void {
		const clientSubs = this.subscriptions.get(socketId);
		if (clientSubs) {
			clientSubs[type].delete(resourceId);
			this.logger.debug(`Removed subscription: ${socketId} -> ${type}:${resourceId}`);
		}
	}

	/**
	 * Get all subscriptions for a client
	 */
	getSubscriptions(socketId: string) {
		return this.subscriptions.get(socketId);
	}

	/**
	 * Unsubscribe from all services
	 */
	async unsubscribeAll(socketId: string): Promise<void> {
		this.subscriptions.delete(socketId);
		this.logger.debug(`Cleared all subscriptions for client: ${socketId}`);
	}

	/**
	 * Get all clients subscribed to a resource
	 */
	getSubscribedClients(type: SubscriptionType, resourceId: string): string[] {
		const clients: string[] = [];
		for (const [socketId, subs] of this.subscriptions.entries()) {
			if (subs[type].has(resourceId)) {
				clients.push(socketId);
			}
		}
		return clients;
	}
}

