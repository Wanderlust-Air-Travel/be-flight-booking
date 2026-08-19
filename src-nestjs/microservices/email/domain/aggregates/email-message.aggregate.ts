import { AggregateRoot } from '../../../../shared/domain/base/aggregate-root';
import { randomUUID } from 'node:crypto';
import { DomainException } from '../../../../shared/domain/exceptions/domain-exception';

export type EmailTemplate =
    | 'BOOKING_CONFIRMATION'
    | 'PAYMENT_SUCCESS'
    | 'PAYMENT_FAILED'
    | 'BOOKING_CANCELLATION'
    | 'RESERVATION_EXPIRED';

export type EmailStatus = 'PENDING' | 'SENT' | 'FAILED';

/**
 * EmailMessage — Aggregate root for the email bounded context.
 *
 * Each email is a record of "what to send" (to/subject/body/template)
 * plus a lifecycle status. Domain events fire on state transitions.
 */
export class EmailMessage extends AggregateRoot<string> {
    private constructor(
        id: string,
        private _to: string,
        private _subject: string,
        private _body: string,
        private _template: EmailTemplate,
        private _status: EmailStatus,
        private _createdAt: Date,
        private _sentAt: Date | null,
        private _attempts: number,
        private _lastError: string | null
    ) {
        super(id);
    }

    static create(input: {
        to: string;
        subject: string;
        body: string;
        template: EmailTemplate;
    }): EmailMessage {
        if (!input.to || !input.to.includes('@')) {
            throw new DomainException(`Invalid email recipient: ${input.to}`);
        }
        if (!input.subject || !input.body) {
            throw new DomainException('Email requires subject and body');
        }
        const id = randomUUID();
        return new EmailMessage(
            id,
            input.to,
            input.subject,
            input.body,
            input.template,
            'PENDING',
            new Date(),
            null,
            0,
            null
        );
    }

    static rehydrate(props: {
        id: string;
        to: string;
        subject: string;
        body: string;
        template: EmailTemplate;
        status: EmailStatus;
        createdAt: Date;
        sentAt: Date | null;
        attempts: number;
        lastError: string | null;
    }): EmailMessage {
        return new EmailMessage(
            props.id,
            props.to,
            props.subject,
            props.body,
            props.template,
            props.status,
            props.createdAt,
            props.sentAt,
            props.attempts,
            props.lastError
        );
    }

    markSent(at: Date): void {
        if (this._status !== 'PENDING') {
            throw new DomainException(
                `Cannot mark sent: email in ${this._status} status`
            );
        }
        this._status = 'SENT';
        this._sentAt = at;
    }

    markFailed(reason: string): void {
        this._status = 'FAILED';
        this._attempts++;
        this._lastError = reason;
    }

    retry(): void {
        if (this._status !== 'FAILED') {
            throw new DomainException(
                `Cannot retry email in ${this._status} status`
            );
        }
        this._status = 'PENDING';
    }

    get to(): string { return this._to; }
    get subject(): string { return this._subject; }
    get body(): string { return this._body; }
    get template(): EmailTemplate { return this._template; }
    get status(): EmailStatus { return this._status; }
    get createdAt(): Date { return this._createdAt; }
    get sentAt(): Date | null { return this._sentAt; }
    get attempts(): number { return this._attempts; }
    get lastError(): string | null { return this._lastError; }
}