import { EmailMessage } from '../email-message.aggregate';
import { DomainException } from '../../../../../shared/domain/exceptions/domain-exception';

describe('EmailMessage aggregate', () => {
    it('creates a PENDING message with valid inputs', () => {
        const e = EmailMessage.create({
            to: 'alice@example.com',
            subject: 'Booking confirmed',
            body: 'Hello!',
            template: 'BOOKING_CONFIRMATION',
        });
        expect(e.status).toBe('PENDING');
        expect(e.attempts).toBe(0);
    });

    it('rejects invalid email', () => {
        expect(() =>
            EmailMessage.create({ to: 'bogus', subject: 'x', body: 'y', template: 'BOOKING_CONFIRMATION' })
        ).toThrow(DomainException);
    });

    it('rejects missing subject', () => {
        expect(() =>
            EmailMessage.create({ to: 'a@b.com', subject: '', body: 'y', template: 'BOOKING_CONFIRMATION' })
        ).toThrow(DomainException);
    });

    it('markSent() transitions PENDING → SENT', () => {
        const e = EmailMessage.create({ to: 'a@b.com', subject: 's', body: 'b', template: 'X' as any });
        e.markSent(new Date());
        expect(e.status).toBe('SENT');
        expect(e.sentAt).toBeDefined();
    });

    it('refuses markSent on non-pending', () => {
        const e = EmailMessage.create({ to: 'a@b.com', subject: 's', body: 'b', template: 'X' as any });
        e.markSent(new Date());
        expect(() => e.markSent(new Date())).toThrow();
    });

    it('markFailed() transitions to FAILED and increments attempts', () => {
        const e = EmailMessage.create({ to: 'a@b.com', subject: 's', body: 'b', template: 'X' as any });
        e.markFailed('smtp 500');
        expect(e.status).toBe('FAILED');
        expect(e.attempts).toBe(1);
        expect(e.lastError).toBe('smtp 500');
    });

    it('retry() allows resending a FAILED email', () => {
        const e = EmailMessage.create({ to: 'a@b.com', subject: 's', body: 'b', template: 'X' as any });
        e.markFailed('first try');
        e.retry();
        expect(e.status).toBe('PENDING');
    });

    it('retry() refuses to retry PENDING emails', () => {
        const e = EmailMessage.create({ to: 'a@b.com', subject: 's', body: 'b', template: 'X' as any });
        expect(() => e.retry()).toThrow();
    });
});