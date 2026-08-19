import { CreatePaymentHandler } from '../create-payment.handler';
import { InMemoryPaymentRepository } from '../../../domain/repositories/in-memory-payment.repository';
import type { IPaymentRepository } from '../../../domain/repositories/payment.repository.interface';

describe('CreatePaymentHandler', () => {
    let handler: CreatePaymentHandler;
    let repo: InMemoryPaymentRepository;
    let outbox: { append: jest.Mock; events: any[] };

    beforeEach(() => {
        repo = new InMemoryPaymentRepository();
        outbox = { append: jest.fn().mockImplementation(async (e) => outbox.events.push(e)), events: [] };
        handler = new CreatePaymentHandler(repo as any, outbox as any);
    });

    it('creates payment and emits PaymentCreatedEvent', async () => {
        const result = await handler.execute({
            bookingId: 'b-1',
            amount: 1000,
            currency: 'VND',
            method: 'credit_card',
            idempotencyKey: 'idem_test_key_123',
        });
        expect(result.paymentId).toBeDefined();
        expect(result.status).toBe('pending');
        expect(outbox.events).toHaveLength(1);
    });

    it('is idempotent on duplicate key', async () => {
        const cmd = {
            bookingId: 'b-1',
            amount: 1000,
            currency: 'VND',
            method: 'credit_card' as const,
            idempotencyKey: 'idem_test_key_456',
        };
        const r1 = await handler.execute(cmd);
        const r2 = await handler.execute(cmd);
        expect(r1.paymentId).toBe(r2.paymentId);
    });

    it('rejects negative amount', async () => {
        await expect(
            handler.execute({
                bookingId: 'b-1',
                amount: -100,
                currency: 'VND',
                method: 'credit_card',
                idempotencyKey: 'idem_test_key_789',
            })
        ).rejects.toThrow();
    });
});