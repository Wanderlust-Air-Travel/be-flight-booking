/**
 * ValueObject<T> — Base class for all DDD value objects.
 *
 * Value objects are immutable, have no identity, and are compared by their
 * structural value (not by reference). Two Money(100, VND) instances are
 * equal regardless of which one you hold.
 *
 * Subclasses define their own factory methods and behavior; the base class
 * provides `getValue()` and `equals()`.
 */
export abstract class ValueObject<T> {
    protected readonly _value: T;

    protected constructor(value: T) {
        this._value = value;
    }

    /** Returns the underlying raw value. */
    getValue(): T {
        return this._value;
    }

    /** Convenience alias for `getValue()`. */
    get value(): T {
        return this._value;
    }

    /**
     * Structural equality. Two value objects are equal if their underlying
     * value is deeply equal. Returns false for null/undefined.
     */
    equals(other: ValueObject<T> | null | undefined): boolean {
        if (other === null || other === undefined) return false;
        return this.deepEqual(this._value, other._value);
    }

    private deepEqual(a: unknown, b: unknown): boolean {
        if (a === b) return true;
        if (typeof a !== typeof b) return false;
        if (a === null || b === null) return a === b;
        if (typeof a !== 'object') return false;
        const aKeys = Object.keys(a as object);
        const bKeys = Object.keys(b as object);
        if (aKeys.length !== bKeys.length) return false;
        for (const key of aKeys) {
            if (!deepEqualSafe(a, b, key)) return false;
        }
        return true;
    }
}

function deepEqualSafe(a: unknown, b: unknown, key: string): boolean {
    const av = (a as Record<string, unknown>)[key];
    const bv = (b as Record<string, unknown>)[key];
    if (av === bv) return true;
    if (typeof av !== typeof bv) return false;
    if (av === null || bv === null) return av === bv;
    if (typeof av !== 'object') return false;
    const aKeys = Object.keys(av as object);
    const bKeys = Object.keys(bv as object);
    if (aKeys.length !== bKeys.length) return false;
    for (const k of aKeys) {
        if (!deepEqualSafe(av, bv, k)) return false;
    }
    return true;
}
