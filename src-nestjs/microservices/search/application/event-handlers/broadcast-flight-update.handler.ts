import { Controller, Logger } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { Server } from 'socket.io';

/**
 * RealtimeGateway — Stateless broadcast handler for real-time updates.
 *
 * Listens to domain events (booking.created, payment.succeeded, flight.update)
 * and broadcasts to subscribed Socket.IO clients.
 *
 * The actual WebSocket gateway lives in the api-gateway folder; this
 * module is the event-driven data source for it.
 */
@Controller()
export class BroadcastFlightUpdateHandler {
    private readonly logger = new Logger(BroadcastFlightUpdateHandler.name);

    @EventPattern('flight.update')
    async handle(payload: any): Promise<void> {
        this.logger.log(`Received flight.update event for ${payload.flightInstanceId}`);
        // Forward to socket.io clients via the realtime gateway
        // (real impl would emit on the gateway's server instance)
    }
}