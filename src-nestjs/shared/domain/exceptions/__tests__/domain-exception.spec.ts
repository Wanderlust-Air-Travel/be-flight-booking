import { DomainException } from '../domain-exception';

describe('DomainException', () => {
    it('is a subclass of Error', () => {
        const ex = new DomainException('something broke');
        expect(ex).toBeInstanceOf(Error);
        expect(ex).toBeInstanceOf(DomainException);
    });

    it('has name = "DomainException"', () => {
        const ex = new DomainException('something broke');
        expect(ex.name).toBe('DomainException');
    });

    it('preserves message', () => {
        const ex = new DomainException('booking cannot be cancelled');
        expect(ex.message).toBe('booking cannot be cancelled');
    });

    it('captures stack trace', () => {
        const ex = new DomainException('x');
        expect(typeof ex.stack).toBe('string');
        expect((ex.stack as string).length).toBeGreaterThan(0);
    });

    it('supports cause (Error cause chain)', () => {
        const cause = new Error('underlying');
        const ex = new DomainException('wrapper', cause);
        expect(ex.cause).toBe(cause);
    });

    it('can be thrown and caught as DomainException', () => {
        expect(() => {
            throw new DomainException('invariant violated');
        }).toThrow(DomainException);
    });

    it('subclasses can extend it (e.g. InvalidBookingTransition)', () => {
        class InvalidBookingTransition extends DomainException {
            constructor(fromStatus: string, toStatus: string) {
                super(`Cannot transition booking from ${fromStatus} to ${toStatus}`);
                this.name = 'InvalidBookingTransition';
            }
        }
        const ex = new InvalidBookingTransition('CANCELLED', 'PAID');
        expect(ex.message).toContain('CANCELLED');
        expect(ex.message).toContain('PAID');
        expect(ex.name).toBe('InvalidBookingTransition');
    });
});
