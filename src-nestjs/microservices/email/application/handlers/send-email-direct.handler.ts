import { Inject, Injectable, Logger } from '@nestjs/common';
import type { IEmailMessageRepository } from '../../domain/repositories/email.repository.interface';
import type { IOutboxWriter } from '../../../../../shared/application/ports/outbox-writer.interface';

export interface SendEmailDirectCommand {
    emailMessageId: string;
    to: string;
    subject: string;
    body: string;
    template: string;
}

export interface SendEmailDirectResponse {
    emailId: string;
    sent: boolean;
    error: string | null;
}

/**
 * SendEmailDirectHandler — TCP-callable send (legacy fallback).
 *
 * Contexts that don't have the email.requested event subscription can
 * call this directly. Uses the same Gmail/SMTP sender as the event handler.
 */
@Injectable()
export class SendEmailDirectHandler {
    private readonly logger = new Logger(SendEmailDirectHandler.name);

    constructor(
        @Inject('IEmailMessageRepository') private readonly repo: IEmailMessageRepository,
        @Inject('IEmailSender') private readonly emailSender: (to: string, subject: string, body: string) => Promise<void>,
        @Inject('IOutboxWriter') private readonly outbox: IOutboxWriter
    ) {}

    async execute(command: SendEmailDirectCommand): Promise<SendEmailDirectResponse> {
        try {
            await this.emailSender(command.to, command.subject, command.body);
            // Update message status if it exists in our repo
            const message = await this.repo.findById(command.emailMessageId);
            if (message) {
                message.markSent(new Date());
                await this.repo.save(message);
            }
            return { emailId: command.emailMessageId, sent: true, error: null };
        } catch (error: any) {
            return {
                emailId: command.emailMessageId,
                sent: false,
                error: error.message ?? 'Unknown error',
            };
        }
    }
}