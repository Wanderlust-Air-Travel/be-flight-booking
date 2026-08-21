import { Injectable } from '@nestjs/common';
import type {
    GatewayChargeInput,
    GatewayChargeResult,
    IPaymentGateway,
} from '../../application/ports/payment-gateway.port';

/**
 * DevPaymentGateway — Test/mock gateway implementation.
 * Returns deterministic results based on amount + method.
 */
@Injectable()
export class DevPaymentGateway implements IPaymentGateway {
    private counter = 0;

    async charge(input: GatewayChargeInput): Promise<GatewayChargeResult> {
        // Simulate processing delay
        await new Promise((r) => setTimeout(r, 10));

        // Deterministic success: amount > 0 always succeeds for non-fail methods
        if (input.amount <= 0) {
            return { success: false, transactionRef: null, failureReason: 'Invalid amount' };
        }
        if (input.method === 'credit_card' && input.cardToken === 'DECLINE') {
            return {
                success: false,
                transactionRef: null,
                failureReason: 'Card declined',
            };
        }

        this.counter++;
        return {
            success: true,
            transactionRef: `DEV-${Date.now()}-${this.counter}`,
            failureReason: null,
        };
    }
}

/**
 * MockPaymentGateway — Pure deterministic mock for unit tests.
 * Implemented in handlers test as inline stubs.
 */
