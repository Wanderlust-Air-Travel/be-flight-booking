import { ValueObject } from '../../../../shared/domain/base/value-object';
import { DomainException } from '../../../../shared/domain/exceptions/domain-exception';

const REF_PATTERN = /^[A-Z0-9_-]{4,64}$/;

/**
 * TransactionRef — Reference number returned by external payment gateway.
 * Format is gateway-specific, but we normalize to uppercase alphanumeric.
 */
export class TransactionRef extends ValueObject<string> {
    private constructor(value: string) {
        super(value);
    }

    static fromString(value: string): TransactionRef {
        const normalized = value.toUpperCase();
        if (!REF_PATTERN.test(normalized)) {
            throw new DomainException(
                `TransactionRef must be 4-64 uppercase alphanumeric chars, got: ${value}`
            );
        }
        return new TransactionRef(normalized);
    }
}
