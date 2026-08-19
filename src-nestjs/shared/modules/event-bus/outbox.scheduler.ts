import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OutboxProcessor } from '../../infrastructure/messaging/outbox-processor';

/**
 * OutboxScheduler — Drives the OutboxProcessor on a cron schedule.
 *
 * Default: every 5 seconds (configurable via OUTBOX_CRON env var).
 * In production this drains the outbox table and publishes pending
 * domain events to RabbitMQ via IDomainEventBus.
 */
@Injectable()
export class OutboxScheduler {
    private readonly logger = new Logger(OutboxScheduler.name);

    constructor(private readonly processor: OutboxProcessor) {}

    @Cron(process.env.OUTBOX_CRON ?? CronExpression.EVERY_5_SECONDS, {
        name: 'outbox-processor',
    })
    async drain(): Promise<void> {
        try {
            const processed = await this.processor.processBatch();
            if (processed > 0) {
                this.logger.log(`Outbox processor published ${processed} event(s)`);
            }
        } catch (error: any) {
            this.logger.error(`Outbox processor error: ${error.message}`, error.stack);
        }
    }
}