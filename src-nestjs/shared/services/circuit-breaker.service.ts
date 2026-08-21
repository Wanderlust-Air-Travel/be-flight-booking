import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CircuitBreakerOptions, CircuitBreakerState } from '../types/circuit-breaker.types';

@Injectable()
export class CircuitBreakerService {
    private readonly logger = new Logger(CircuitBreakerService.name);
    private readonly breakers = new Map<string, CircuitBreakerState>();
    private readonly defaultOptions: Required<CircuitBreakerOptions>;

    constructor(private readonly configService: ConfigService) {
        this.defaultOptions = {
            timeout: this.configService.get<number>('circuitBreaker.timeout', 3000),
            errorThresholdPercentage: this.configService.get<number>(
                'circuitBreaker.errorThresholdPercentage',
                50
            ),
            resetTimeout: this.configService.get<number>('circuitBreaker.resetTimeout', 30000),
        };
    }

    async execute<T>(
        name: string,
        fn: () => Promise<T>,
        options?: CircuitBreakerOptions
    ): Promise<T> {
        const opts = { ...this.defaultOptions, ...options };
        const breaker = this.getOrCreateBreaker(name);

        // Check if circuit is open
        if (breaker.isOpen) {
            const timeSinceLastFailure =
                new Date().getTime() - (breaker.lastFailureTime?.getTime() || 0);
            if (timeSinceLastFailure < opts.resetTimeout) {
                this.logger.warn(`Circuit breaker ${name} is OPEN. Request rejected.`);
                throw new Error(
                    `Circuit breaker ${name} is open. Service temporarily unavailable.`
                );
            }
            // Half-open: try again
            this.logger.log(`Circuit breaker ${name} is HALF-OPEN. Attempting request.`);
            breaker.isOpen = false;
        }

        try {
            // Execute with timeout
            const result = await Promise.race([
                fn(),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Operation timeout')), opts.timeout)
                ),
            ]);

            // Success: reset failure count
            breaker.failureCount = 0;
            breaker.successCount++;
            if (breaker.successCount >= 3) {
                // After 3 successes, consider circuit closed
                breaker.isOpen = false;
            }

            return result;
        } catch (error) {
            // Failure: increment failure count
            breaker.failureCount++;
            breaker.lastFailureTime = new Date();

            const totalRequests = breaker.failureCount + breaker.successCount;
            const errorRate = (breaker.failureCount / totalRequests) * 100;

            if (errorRate >= opts.errorThresholdPercentage) {
                breaker.isOpen = true;
                this.logger.error(
                    `Circuit breaker ${name} OPENED. Error rate: ${errorRate.toFixed(2)}%`
                );
            }

            throw error;
        }
    }

    private getOrCreateBreaker(name: string): CircuitBreakerState {
        if (!this.breakers.has(name)) {
            this.breakers.set(name, {
                isOpen: false,
                failureCount: 0,
                successCount: 0,
            });
        }
        return this.breakers.get(name)!;
    }

    getBreakerState(name: string): CircuitBreakerState | undefined {
        return this.breakers.get(name);
    }

    resetBreaker(name: string): void {
        this.breakers.delete(name);
        this.logger.log(`Circuit breaker ${name} reset`);
    }
}
