/**
 * DomainException — Base class for all domain-layer exceptions.
 *
 * Thrown by aggregates and value objects when a business invariant is
 * violated (e.g. "cannot cancel a booking in PAID state"). The application
 * layer translates these to HTTP/RPC errors at the interface boundary.
 *
 * Subclass for specific violation types so consumers can match on `.name`.
 */
export class DomainException extends Error {
    constructor(message: string, public readonly cause?: unknown) {
        super(message);
        this.name = 'DomainException';
        // Capture stack trace (V8 only; harmless elsewhere)
        if (typeof (Error as any).captureStackTrace === 'function') {
            (Error as any).captureStackTrace(this, this.constructor);
        }
    }
}