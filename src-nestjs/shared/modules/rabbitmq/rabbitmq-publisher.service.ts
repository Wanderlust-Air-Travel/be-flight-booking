import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - uuid package is ESM but works fine with CommonJS
import { v7 as uuidv7 } from 'uuid';
import { RedisService } from '../redis/redis.service';
import { RabbitMQService } from './rabbitmq.service';

/**
 * RabbitMQ Publisher Service
 *
 * Provides high-level methods for publishing messages to RabbitMQ.
 * This service abstracts the RabbitMQ details and provides business-friendly methods.
 *
 * Features:
 * - Message deduplication (idempotency)
 * - Correlation IDs for tracing
 * - Message TTL support
 * - Priority queues
 */
@Injectable()
export class RabbitMQPublisherService {
    private readonly logger = new Logger(RabbitMQPublisherService.name);
    private readonly emailQueue: string;
    private readonly ticketQueue: string;
    private readonly eventsExchange: string;
    private readonly enableIdempotency: boolean;
    private readonly idempotencyTtl: number;

    constructor(
        private readonly rabbitMQService: RabbitMQService,
        private readonly configService: ConfigService,
        private readonly redisService: RedisService
    ) {
        this.emailQueue = this.configService.get<string>(
            'RABBITMQ_QUEUE_EMAIL',
            'email_notifications'
        );
        this.ticketQueue = this.configService.get<string>(
            'RABBITMQ_QUEUE_TICKETS',
            'ticket_creation'
        );
        this.eventsExchange = this.configService.get<string>(
            'RABBITMQ_EXCHANGE_EVENTS',
            'flight_booking_events'
        );
        this.enableIdempotency = this.configService.get<boolean>(
            'RABBITMQ_ENABLE_IDEMPOTENCY',
            true
        );
        this.idempotencyTtl = this.configService.get<number>('RABBITMQ_IDEMPOTENCY_TTL', 3600);
    }

    async publishEmail(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        message: any,
        options?: {
            idempotencyKey?: string;
            ttl?: number;
            priority?: number;
            correlationId?: string;
        }
    ): Promise<boolean> {
        if (!this.rabbitMQService.isConnected()) {
            this.logger.warn('RabbitMQ not connected, attempting to connect...');
            await this.rabbitMQService.connect();
        }

        const correlationId = options?.correlationId || uuidv7();
        const messageId = uuidv7();

        if (this.enableIdempotency && options?.idempotencyKey) {
            const idempotencyKey = `rabbitmq:idempotency:email:${options.idempotencyKey}`;
            const exists = await this.redisService.get(idempotencyKey);
            if (exists) {
                this.logger.warn(
                    `Duplicate email message detected (idempotency key: ${options.idempotencyKey})`
                );
                return false;
            }
            await this.redisService.set(
                idempotencyKey,
                { messageId, timestamp: Date.now() },
                this.idempotencyTtl
            );
        }

        const messageWithMetadata = {
            ...message,
            correlationId,
            messageId,
            timestamp: Date.now(),
            ...(options?.idempotencyKey && { idempotencyKey: options.idempotencyKey }),
        };

        const emailTtl = options?.ttl || 3600000;
        const priority = options?.priority || 0;

        const sent = await this.rabbitMQService.sendToQueue(
            this.emailQueue,
            messageWithMetadata,
            { ttl: emailTtl, priority, correlationId, messageId }
        );

        if (sent) {
            this.logger.log(
                `Email message published to queue: ${this.emailQueue} [correlationId: ${correlationId}, priority: ${priority}]`
            );
        } else {
            this.logger.warn(`Failed to publish email message to queue: ${this.emailQueue}`);
        }
        return sent;
    }

    async publishTicketCreation(
        message: { bookingId: string; [key: string]: any },
        options?: {
            idempotencyKey?: string;
            ttl?: number;
            priority?: number;
            correlationId?: string;
        }
    ): Promise<boolean> {
        if (!this.rabbitMQService.isConnected()) {
            this.logger.warn('RabbitMQ not connected, attempting to connect...');
            await this.rabbitMQService.connect();
        }

        const correlationId = options?.correlationId || uuidv7();
        const messageId = uuidv7();
        const idempotencyKey = options?.idempotencyKey || message.bookingId;

        if (this.enableIdempotency) {
            const idempotencyRedisKey = `rabbitmq:idempotency:ticket:${idempotencyKey}`;
            const exists = await this.redisService.get(idempotencyRedisKey);
            if (exists) {
                this.logger.warn(
                    `Duplicate ticket creation message detected (bookingId: ${message.bookingId})`
                );
                return false;
            }
            await this.redisService.set(
                idempotencyRedisKey,
                { messageId, bookingId: message.bookingId, timestamp: Date.now() },
                86400
            );
        }

        const messageWithMetadata = {
            ...message,
            correlationId,
            messageId,
            timestamp: Date.now(),
            idempotencyKey,
        };

        const ticketTtl = options?.ttl || 86400000;
        const priority = options?.priority !== undefined ? options.priority : 100;

        const sent = await this.rabbitMQService.sendToQueue(
            this.ticketQueue,
            messageWithMetadata,
            { ttl: ticketTtl, priority, correlationId, messageId }
        );

        if (sent) {
            this.logger.log(
                `Ticket creation message published to queue: ${this.ticketQueue} [bookingId: ${message.bookingId}, correlationId: ${correlationId}, priority: ${priority}]`
            );
        } else {
            this.logger.warn(
                `Failed to publish ticket creation message to queue: ${this.ticketQueue}`
            );
        }
        return sent;
    }

    async publishEvent(
        routingKey: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        event: any,
        options?: {
            correlationId?: string;
            priority?: number;
        }
    ): Promise<boolean> {
        if (!this.rabbitMQService.isConnected()) {
            this.logger.warn('RabbitMQ not connected, attempting to connect...');
            await this.rabbitMQService.connect();
        }

        await this.rabbitMQService.assertExchange(this.eventsExchange, 'topic', { durable: true });

        const correlationId = options?.correlationId || uuidv7();
        const messageId = uuidv7();

        const eventWithMetadata = {
            ...event,
            correlationId,
            messageId,
            timestamp: Date.now(),
        };

        const priority = options?.priority || 0;

        const published = await this.rabbitMQService.publish(
            this.eventsExchange,
            routingKey,
            eventWithMetadata,
            { persistent: true, timestamp: Date.now(), correlationId, messageId, priority }
        );

        if (published) {
            this.logger.log(
                `Event published to exchange: ${this.eventsExchange}, routing key: ${routingKey} [correlationId: ${correlationId}]`
            );
        } else {
            this.logger.warn(
                `Failed to publish event to exchange: ${this.eventsExchange}, routing key: ${routingKey}`
            );
        }
        return published;
    }
}