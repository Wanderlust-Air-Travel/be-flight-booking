import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { IReservationRepository } from '../../domain/repositories/reservation.repository.interface';
import type { IOutboxWriter } from '../../../../../shared/application/ports/outbox-writer.interface';

/**
 * ExpireReservationScheduler — Cron job that finds ACTIVE reservations
 * past their expiresAt and transitions them to EXPIRED.
 *
 * Runs every minute; emits ReservationExpiredEvent to the outbox.
 */
@Injectable()
export class ExpireReservationScheduler {
    private readonly logger = new Logger(ExpireReservationScheduler.name);

    constructor(
        @Inject('IReservationRepository') private readonly repo: IReservationRepository,
        @Inject('IOutboxWriter') private readonly outbox: IOutboxWriter
    ) {}

    @Cron(CronExpression.EVERY_MINUTE, { name: 'expire-reservations' })
    async expireOverdue(): Promise<void> {
        const now = new Date();
        const overdue = await this.repo.findExpiringBefore(now, 50);
        if (overdue.length === 0) return;
        this.logger.log(`Expiring ${overdue.length} overdue reservations`);
        for (const reservation of overdue) {
            try {
                reservation.expire();
                await this.repo.save(reservation);
                for (const event of reservation.pullDomainEvents()) {
                    await this.outbox.append(event);
                }
            } catch (error: any) {
                this.logger.error(
                    `Failed to expire reservation ${reservation.id}: ${error.message}`
                );
            }
        }
    }
}