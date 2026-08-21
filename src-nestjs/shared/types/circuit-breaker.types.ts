/**
 * Circuit Breaker Types
 *
 * Type definitions for circuit breaker service
 */

export interface CircuitBreakerOptions {
    timeout?: number;
    errorThresholdPercentage?: number;
    resetTimeout?: number;
}

export interface CircuitBreakerState {
    isOpen: boolean;
    failureCount: number;
    lastFailureTime?: Date;
    successCount: number;
}
