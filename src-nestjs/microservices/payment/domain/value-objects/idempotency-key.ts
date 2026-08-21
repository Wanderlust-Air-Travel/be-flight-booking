import { ValueObject } from '../../../../shared/domain/base/value-object';
import { DomainException } from '../../../../shared/domain/exceptions/domain-exception';

const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * IdempotencyKey — Unique key for payment deduplication.
 *
 * Clients send this in `Idempotency-Key` header; if a payment with the
 * same key exists, the create handler returns the existing payment
 * instead of creating a duplicate.
 */
export class IdempotencyKey extends ValueObject<string> {
    private constructor(value: string) {
        super(value);
    }

    static fromString(value: string): IdempotencyKey {
        if (!IDEMPOTENCY_PATTERN.test(value)) {
            throw new DomainException(
                `IdempotencyKey must be 8-128 alphanumeric chars, got: ${value}`
            );
        }
        return new IdempotencyKey(value);
    }

    static generate(): IdempotencyKey {
        const random = Math.random().toString(36).substring(2, 18);
        const ts = Date.now().toString(36);
        return new IdempotencyKey(`idem_${ts}_${random}`);
    }
}
