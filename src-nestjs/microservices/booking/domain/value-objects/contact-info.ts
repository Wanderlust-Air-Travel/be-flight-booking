import { ValueObject } from '../../../../shared/domain/base/value-object';
import { DomainException } from '../../../../shared/domain/exceptions/domain-exception';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?\d{7,15}$/;

/**
 * ContactInfo — Value object for the booking's primary contact person.
 *
 * Carries full name, email, and phone. Email/phone format is checked on
 * construction; trimming is applied to fullName.
 */
export class ContactInfo extends ValueObject<{
    fullName: string;
    email: string;
    phone: string;
}> {
    private constructor(value: { fullName: string; email: string; phone: string }) {
        super(value);
    }

    static create(fullName: string, email: string, phone: string): ContactInfo {
        const trimmedName = (fullName ?? '').trim();
        if (!trimmedName) {
            throw new DomainException('ContactInfo: fullName cannot be empty');
        }
        if (!email || !EMAIL_PATTERN.test(email)) {
            throw new DomainException(`ContactInfo: invalid email format: ${email}`);
        }
        if (!phone || !PHONE_PATTERN.test(phone.replace(/[\s-]/g, ''))) {
            throw new DomainException(`ContactInfo: invalid phone format: ${phone}`);
        }
        return new ContactInfo({
            fullName: trimmedName,
            email: email.toLowerCase(),
            phone: phone.replace(/[\s-]/g, ''),
        });
    }

    get fullName(): string {
        return this.value.fullName;
    }

    get email(): string {
        return this.value.email;
    }

    get phone(): string {
        return this.value.phone;
    }
}
