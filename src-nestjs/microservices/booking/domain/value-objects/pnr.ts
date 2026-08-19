import { ValueObject } from '../../../../shared/domain/base/value-object';
import { DomainException } from '../../../../shared/domain/exceptions/domain-exception';
import type { IBookingRepository } from '../../repositories/booking.repository.interface';

const PNR_PATTERN = /^[A-Z0-9]{6}$/;

/**
 * PNR — Booking's Passenger Name Record code.
 *
 * 6-character alphanumeric code (uppercase A-Z + 0-9) used as the
 * customer-facing reference for a booking. Generated on creation with
 * collision check against the repository.
 */
export class PNR extends ValueObject<string> {
    private constructor(value: string) {
        super(value);
    }

    static fromString(value: string): PNR {
        if (typeof value !== 'string') {
            throw new DomainException(`PNR must be a string, got: ${typeof value}`);
        }
        const normalized = value.toUpperCase();
        if (!PNR_PATTERN.test(normalized)) {
            throw new DomainException(
                `PNR must be 6 uppercase alphanumeric chars, got: ${value}`
            );
        }
        return new PNR(normalized);
    }

    /** Synchronous generation without collision check (for tests). */
    static generate(): PNR {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return new PNR(result);
    }

    /**
     * Async generation with collision check via repository.
     * Retries up to 10 times then throws.
     */
    static async generateWithCollisionCheck(repo: IBookingRepository): Promise<PNR> {
        const maxAttempts = 10;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const candidate = PNR.generate();
            const existing = await repo.findByPnr(candidate.value);
            if (!existing) return candidate;
        }
        throw new DomainException('Failed to generate unique PNR after 10 attempts');
    }
}