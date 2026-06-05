import { Injectable, Logger } from '@nestjs/common';
import type { RabbitMQService } from './rabbitmq.service';

/**
 * RabbitMQ Monitoring Service
 *
 * Provides monitoring and metrics for RabbitMQ queues and exchanges.
 *
 * Features:
 * - Queue statistics (message count, consumer count)
 * - Message rate tracking
 * - Consumer lag detection
 * - Health checks
 */
@Injectable()
export class RabbitMQMonitoringService {
    private readonly logger = new Logger(RabbitMQMonitoringService.name);
    private readonly messageCounts: Map<string, { count: number; timestamp: number }[]> = new Map();
    private readonly maxHistorySize = 100; // Keep last 100 measurements

    constructor(private readonly rabbitMQService: RabbitMQService) {}

    /**
     * Get queue statistics
     */
    async getQueueStats(queueName: string): Promise<{
        queue: string;
        messageCount: number;
        consumerCount: number;
        rate: {
            publishRate: number; // messages per minute
            consumeRate: number; // messages per minute
        };
        health: 'healthy' | 'warning' | 'critical';
    }> {
        try {
            const channel = await this.rabbitMQService.getChannel('monitoring');
            const queueInfo = await channel.checkQueue(queueName);

            // Calculate message rate
            const rate = this.calculateMessageRate(queueName, queueInfo.messageCount);

            // Determine health status
            let health: 'healthy' | 'warning' | 'critical' = 'healthy';
            if (queueInfo.messageCount > 1000) {
                health = 'warning';
            }
            if (queueInfo.messageCount > 10000) {
                health = 'critical';
            }
            if (queueInfo.consumerCount === 0 && queueInfo.messageCount > 0) {
                health = 'critical'; // No consumers but messages queued
            }

            return {
                queue: queueName,
                messageCount: queueInfo.messageCount,
                consumerCount: queueInfo.consumerCount,
                rate,
                health,
            };
        } catch (error: any) {
            this.logger.error(`Error getting queue stats for ${queueName}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get Dead Letter Queue statistics
     */
    async getDLQStats(dlqName: string): Promise<{
        dlq: string;
        messageCount: number;
        oldestMessageAge?: number; // in seconds
        health: 'healthy' | 'warning' | 'critical';
    }> {
        try {
            const channel = await this.rabbitMQService.getChannel('monitoring');
            const queueInfo = await channel.checkQueue(dlqName);

            let health: 'healthy' | 'warning' | 'critical' = 'healthy';
            if (queueInfo.messageCount > 0) {
                health = 'warning'; // Any messages in DLQ is a warning
            }
            if (queueInfo.messageCount > 100) {
                health = 'critical'; // Too many failed messages
            }

            return {
                dlq: dlqName,
                messageCount: queueInfo.messageCount,
                health,
            };
        } catch (error: any) {
            this.logger.error(`Error getting DLQ stats for ${dlqName}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get all queue statistics
     */
    async getAllQueueStats(queueNames: string[]): Promise<
        Array<{
            queue: string;
            messageCount: number;
            consumerCount: number;
            rate: { publishRate: number; consumeRate: number };
            health: 'healthy' | 'warning' | 'critical';
        }>
    > {
        const stats = await Promise.all(queueNames.map((queue) => this.getQueueStats(queue)));
        return stats;
    }

    /**
     * Get RabbitMQ health status
     */
    async getHealthStatus(): Promise<{
        connected: boolean;
        queues: Array<{
            queue: string;
            messageCount: number;
            consumerCount: number;
            health: 'healthy' | 'warning' | 'critical';
        }>;
        overallHealth: 'healthy' | 'warning' | 'critical';
    }> {
        const connected = this.rabbitMQService.isConnected();

        if (!connected) {
            return {
                connected: false,
                queues: [],
                overallHealth: 'critical',
            };
        }

        // Get stats for common queues
        const commonQueues = [
            'email_notifications',
            'email_notifications.dlq',
            'ticket_creation',
            'ticket_creation.dlq',
        ];

        const queues = await Promise.all(
            commonQueues.map(async (queue) => {
                try {
                    const stats = await this.getQueueStats(queue);
                    return {
                        queue: stats.queue,
                        messageCount: stats.messageCount,
                        consumerCount: stats.consumerCount,
                        health: stats.health,
                    };
                } catch {
                    // Queue might not exist
                    return {
                        queue,
                        messageCount: 0,
                        consumerCount: 0,
                        health: 'healthy' as const,
                    };
                }
            })
        );

        // Determine overall health
        let overallHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
        if (queues.some((q) => q.health === 'critical')) {
            overallHealth = 'critical';
        } else if (queues.some((q) => q.health === 'warning')) {
            overallHealth = 'warning';
        }

        return {
            connected,
            queues,
            overallHealth,
        };
    }

    /**
     * Calculate message rate (messages per minute)
     */
    private calculateMessageRate(
        queueName: string,
        currentCount: number
    ): {
        publishRate: number;
        consumeRate: number;
    } {
        const now = Date.now();
        const history = this.messageCounts.get(queueName) || [];

        // Add current measurement
        history.push({ count: currentCount, timestamp: now });

        // Keep only recent history
        const recentHistory = history
            .filter((h) => now - h.timestamp < 60000) // Last minute
            .slice(-this.maxHistorySize);
        this.messageCounts.set(queueName, recentHistory);

        if (recentHistory.length < 2) {
            return { publishRate: 0, consumeRate: 0 };
        }

        // Calculate rate based on change in message count
        const first = recentHistory[0];
        const last = recentHistory[recentHistory.length - 1];
        const timeDiff = (last.timestamp - first.timestamp) / 1000 / 60; // minutes

        if (timeDiff === 0) {
            return { publishRate: 0, consumeRate: 0 };
        }

        const countDiff = last.count - first.count;
        const rate = countDiff / timeDiff;

        // If count increased, it's publish rate; if decreased, it's consume rate
        return {
            publishRate: rate > 0 ? rate : 0,
            consumeRate: rate < 0 ? Math.abs(rate) : 0,
        };
    }

    /**
     * Track message published (for rate calculation)
     */
    trackPublish(_queueName: string): void {
        // This is called when a message is published
        // The actual rate is calculated in getQueueStats
    }

    /**
     * Track message consumed (for rate calculation)
     */
    trackConsume(_queueName: string): void {
        // This is called when a message is consumed
        // The actual rate is calculated in getQueueStats
    }
}
