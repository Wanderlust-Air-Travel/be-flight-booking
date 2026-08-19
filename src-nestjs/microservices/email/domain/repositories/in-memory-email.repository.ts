import type { EmailMessage } from '../aggregates/email-message.aggregate';
import type { IEmailMessageRepository, Page, PageOptions } from './email.repository.interface';

export class InMemoryEmailRepository implements IEmailMessageRepository {
    private readonly messages: Map<string, EmailMessage> = new Map();

    async save(message: EmailMessage): Promise<void> {
        this.messages.set(message.id, message);
    }

    async findById(id: string): Promise<EmailMessage | null> {
        return this.messages.get(id) ?? null;
    }

    async findFailed(opts: PageOptions): Promise<Page<EmailMessage>> {
        const all = [...this.messages.values()].filter((m) => m.status === 'FAILED');
        const start = (opts.page - 1) * opts.limit;
        const items = all.slice(start, start + opts.limit);
        return { items, total: all.length, page: opts.page, limit: opts.limit };
    }

    async delete(id: string): Promise<void> {
        this.messages.delete(id);
    }
}