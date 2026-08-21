import { Injectable, Logger } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { CircuitBreakerService } from './circuit-breaker.service';
import { RetryService } from './retry.service';
import { TimeoutService } from './timeout.service';

@Injectable()
export class MicroserviceClientService {
    private readonly logger = new Logger(MicroserviceClientService.name);

    constructor(
        private readonly circuitBreakerService: CircuitBreakerService,
        private readonly retryService: RetryService,
        private readonly timeoutService: TimeoutService
    ) {}

    async send<T>(
        client: ClientProxy,
        pattern: string,
        data: any,
        options?: {
            circuitBreakerName?: string;
            maxRetries?: number;
            retryDelay?: number;
            timeout?: number;
        }
    ): Promise<T> {
        const circuitBreakerName = options?.circuitBreakerName || `ms-${pattern}`;
        const maxRetries = options?.maxRetries ?? 3;
        const retryDelay = options?.retryDelay ?? 1000;
        const timeout = options?.timeout;

        // Create observable with timeout
        const observable = client.send<T>(pattern, data);
        const withTimeout = timeout
            ? this.timeoutService.withTimeout(observable, timeout, `Microservice ${pattern}`)
            : observable;

        // Add retry with exponential backoff
        const withRetry = this.retryService.retryWithBackoff(
            withTimeout,
            maxRetries,
            retryDelay,
            `Microservice ${pattern}`
        );

        // Wrap with circuit breaker
        return this.circuitBreakerService.execute(circuitBreakerName, () =>
            firstValueFrom(withRetry)
        );
    }
}
