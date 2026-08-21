import { DomainException } from '../../../../../shared/domain/exceptions/domain-exception';
import {
    PaymentCreatedEvent,
    PaymentExpiredEvent,
    PaymentFailedEvent,
    PaymentRefundedEvent,
    PaymentSucceededEvent,
} from '../../events/payment.events';
import { InMemoryPaymentRepository } from '../../repositories/in-memory-payment.repository';
import { IdempotencyKey } from '../../value-objects/idempotency-key';
import { PaymentStatus } from '../../value-objects/payment-status';
import { Payment } from '../payment.aggregate';

async function build(repo: InMemoryPaymentRepository, overrides: any = {}) {
    return Payment.create(
        {
            bookingId: 'booking-1',
            amount: 1000,
            currency: 'VND',
            method: 'credit_card',
            idempotencyKey: IdempotencyKey.generate(),
            ...overrides,
        },
        repo
    );
}

describe('Payment aggregate', () => {
    let repo: InMemoryPaymentRepository;
    beforeEach(() => {
        repo = new InMemoryPaymentRepository();
    });

    describe('create()', () => {
        it('creates a PENDING payment with PaymentCreatedEvent', async () => {
            const p = await build(repo);
            expect(p.status).toBe(PaymentStatus.PENDING);
            const events = p.pullDomainEvents();
            expect(events[0]).toBeInstanceOf(PaymentCreatedEvent);
        });

        it('throws on negative amount', async () => {
            await expect(build(repo, { amount: -100 })).rejects.toThrow();
        });

        it('returns existing payment when idempotency key matches', async () => {
            const idem = IdempotencyKey.fromString('idem_test_key_1234');
            const p1 = await build(repo, { idempotencyKey: idem });
            await repo.save(p1);
            const p2 = await build(repo, { idempotencyKey: idem });
            expect(p1.id).toBe(p2.id);
        });
    });

    describe('markSucceeded()', () => {
        it('transitions PENDING → SUCCESS with PaymentSucceededEvent', async () => {
            const p = await build(repo);
            p.pullDomainEvents();
            p.markSucceeded('TX-ABC-12345', 1, new Date());
            expect(p.status).toBe(PaymentStatus.SUCCESS);
            const events = p.pullDomainEvents();
            expect(events[0]).toBeInstanceOf(PaymentSucceededEvent);
            expect((events[0] as PaymentSucceededEvent).transactionRef).toBe('TX-ABC-12345');
        });

        it('throws when not PENDING', async () => {
            const p = await build(repo);
            p.markSucceeded('TX-1', 1, new Date());
            expect(() => p.markSucceeded('TX-2', 1, new Date())).toThrow(DomainException);
        });
    });

    describe('markFailed()', () => {
        it('transitions PENDING → FAILED with PaymentFailedEvent', async () => {
            const p = await build(repo);
            p.pullDomainEvents();
            p.markFailed('insufficient funds');
            expect(p.status).toBe(PaymentStatus.FAILED);
            expect(p.pullDomainEvents()[0]).toBeInstanceOf(PaymentFailedEvent);
        });

        it('throws when not PENDING', async () => {
            const p = await build(repo);
            p.markSucceeded('TX-1', 1, new Date());
            expect(() => p.markFailed('x')).toThrow(DomainException);
        });
    });

    describe('expire()', () => {
        it('transitions PENDING → EXPIRED', async () => {
            const p = await build(repo);
            p.pullDomainEvents();
            p.expire();
            expect(p.status).toBe(PaymentStatus.EXPIRED);
            expect(p.pullDomainEvents()[0]).toBeInstanceOf(PaymentExpiredEvent);
        });

        it('throws when not PENDING', async () => {
            const p = await build(repo);
            p.markSucceeded('TX-1', 1, new Date());
            expect(() => p.expire()).toThrow(DomainException);
        });
    });

    describe('refund()', () => {
        it('transitions SUCCESS → REFUNDED with PaymentRefundedEvent', async () => {
            const p = await build(repo);
            p.markSucceeded('TX-1', 1, new Date());
            p.pullDomainEvents();
            p.refund(500, 'customer changed mind');
            expect(p.status).toBe(PaymentStatus.REFUNDED);
            expect(p.pullDomainEvents()[0]).toBeInstanceOf(PaymentRefundedEvent);
        });

        it('rejects refund amount > payment amount', async () => {
            const p = await build(repo, { amount: 1000 });
            p.markSucceeded('TX-1', 1, new Date());
            expect(() => p.refund(2000, 'x')).toThrow(DomainException);
        });

        it('rejects negative refund', async () => {
            const p = await build(repo);
            p.markSucceeded('TX-1', 1, new Date());
            expect(() => p.refund(-1, 'x')).toThrow(DomainException);
        });

        it('refuses refund on non-successful payment', async () => {
            const p = await build(repo);
            p.markFailed('insufficient funds');
            expect(() => p.refund(500, 'x')).toThrow(DomainException);
        });
    });

    describe('rehydrate()', () => {
        it('rebuilds Payment without emitting events', () => {
            const p = Payment.rehydrate({
                id: 'p1',
                bookingId: 'b1',
                amount: 1000,
                currency: 'VND',
                method: 'credit_card',
                idempotencyKey: IdempotencyKey.generate(),
                status: PaymentStatus.SUCCESS,
                transactionRef: null,
                createdAt: new Date('2026-01-01'),
                completedAt: new Date('2026-01-02'),
            });
            expect(p.id).toBe('p1');
            expect(p.status).toBe(PaymentStatus.SUCCESS);
            expect(p.pullDomainEvents()).toHaveLength(0);
        });
    });
});
