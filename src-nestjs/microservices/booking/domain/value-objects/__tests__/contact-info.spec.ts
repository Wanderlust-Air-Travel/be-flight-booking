import { DomainException } from '../../../../../shared/domain/exceptions/domain-exception';
import { ContactInfo } from '../contact-info';

describe('ContactInfo', () => {
    describe('create()', () => {
        it('creates ContactInfo with valid email and phone', () => {
            const c = ContactInfo.create('Alice Nguyen', 'alice@example.com', '+84912345678');
            expect(c.fullName).toBe('Alice Nguyen');
            expect(c.email).toBe('alice@example.com');
            expect(c.phone).toBe('+84912345678');
        });

        it('trims whitespace from fullName', () => {
            const c = ContactInfo.create('  Alice  ', 'alice@example.com', '+84912345678');
            expect(c.fullName).toBe('Alice');
        });

        it('throws on empty fullName', () => {
            expect(() => ContactInfo.create('', 'a@b.com', '+123')).toThrow(DomainException);
            expect(() => ContactInfo.create('   ', 'a@b.com', '+123')).toThrow(DomainException);
        });

        it('throws on invalid email format', () => {
            expect(() => ContactInfo.create('Alice', 'notanemail', '+123')).toThrow(
                DomainException
            );
            expect(() => ContactInfo.create('Alice', 'a@b', '+123')).toThrow(DomainException);
            expect(() => ContactInfo.create('Alice', '@b.com', '+123')).toThrow(DomainException);
            expect(() => ContactInfo.create('Alice', '', '+123')).toThrow(DomainException);
        });

        it('accepts emails with subdomains and plus addressing', () => {
            const c = ContactInfo.create('Alice', 'alice+tag@mail.example.co.uk', '+1234567890');
            expect(c.email).toBe('alice+tag@mail.example.co.uk');
        });

        it('throws on invalid phone (not E.164-ish)', () => {
            expect(() => ContactInfo.create('Alice', 'a@b.com', 'abc')).toThrow(DomainException);
            expect(() => ContactInfo.create('Alice', 'a@b.com', '')).toThrow(DomainException);
            // Less than 7 digits
            expect(() => ContactInfo.create('Alice', 'a@b.com', '+12')).toThrow(DomainException);
        });

        it('accepts phone with + prefix and 7+ digits', () => {
            expect(() => ContactInfo.create('Alice', 'a@b.com', '+1234567')).not.toThrow();
            expect(() => ContactInfo.create('Alice', 'a@b.com', '1234567')).not.toThrow();
        });
    });

    describe('equality', () => {
        it('equals() returns true for structurally same ContactInfo', () => {
            const a = ContactInfo.create('Alice', 'alice@example.com', '+84912345678');
            const b = ContactInfo.create('Alice', 'alice@example.com', '+84912345678');
            expect(a.equals(b)).toBe(true);
        });

        it('equals() returns false for different fields', () => {
            const a = ContactInfo.create('Alice', 'alice@example.com', '+84912345678');
            const b = ContactInfo.create('Bob', 'alice@example.com', '+84912345678');
            expect(a.equals(b)).toBe(false);
        });
    });
});
