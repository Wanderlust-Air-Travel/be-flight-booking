import { randomUUID } from 'node:crypto';
import type { IDomainEvent } from '../../../../shared/domain/events/domain-event';

abstract class BaseEmailEvent implements IDomainEvent {
    public readonly eventId: string;
    public readonly aggregateId: string;
    public readonly occurredAt: Date;
    public readonly version = 1;

    constructor(
        aggregateId: string,
        public readonly eventName: string,
        public readonly payload: Record<string, unknown>,
        occurredAt?: Date
    ) {
        this.eventId = randomUUID();
        this.aggregateId = aggregateId;
        this.occurredAt = occurredAt ?? new Date();
    }
}

export class EmailRequestedEvent extends BaseEmailEvent {
    static readonly EVENT_NAME = 'email.requested';
    constructor(
        public readonly emailMessageId: string,
        public readonly to: string,
        public readonly template: string
    ) {
        super(emailMessageId, EmailRequestedEvent.EVENT_NAME, { to, template });
    }
}

export class EmailSentEvent extends BaseEmailEvent {
    static readonly EVENT_NAME = 'email.sent';
    constructor(
        public readonly emailMessageId: string,
        public readonly sentAt: Date
    ) {
        super(emailMessageId, EmailSentEvent.EVENT_NAME, {
            sentAt: sentAt.toISOString(),
        });
    }
}

export class EmailFailedEvent extends BaseEmailEvent {
    static readonly EVENT_NAME = 'email.failed';
    constructor(
        public readonly emailMessageId: string,
        public readonly reason: string,
        public readonly attempts: number
    ) {
        super(emailMessageId, EmailFailedEvent.EVENT_NAME, { reason, attempts });
    }
}