import { EmailMessage } from '../aggregates/email-message.aggregate';

export interface PageOptions {
    page: number;
    limit: number;
}

export interface Page<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
}

/**
 * IEmailMessageRepository — Domain-layer port for email persistence.
 * Stateless emails are optional; provided here for retry logging.
 */
export interface IEmailMessageRepository {
    save(message: EmailMessage): Promise<void>;
    findById(id: string): Promise<EmailMessage | null>;
    findFailed(opts: PageOptions): Promise<Page<EmailMessage>>;
    delete(id: string): Promise<void>;
}

export const EMAIL_REPOSITORY = 'IEmailMessageRepository';