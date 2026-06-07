import type { EmailStatus } from 'src/shared/constants/enums';
import { SendEmailDto } from '../dto/send-email.dto';

/**
 * Interface for queued email in Email Queue Service
 */
export interface QueuedEmail {
    id: string;
    dto: SendEmailDto;
    status: EmailStatus;
    retryCount: number;
    maxRetries: number;
    queuedAt: Date;
    sentAt?: Date;
    error?: string;
    nextRetryAt?: Date;
}
