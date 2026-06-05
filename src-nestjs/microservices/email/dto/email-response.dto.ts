import { EmailStatus } from 'src/shared/constants/enums';

// Re-export EmailStatus for convenience
export { EmailStatus };

export class EmailResponseDto {
    emailId!: string;
    to!: string;
    subject!: string;
    status!: EmailStatus;
    error?: string;
    queuedAt!: Date;
    sentAt?: Date;
    retryCount!: number;
}
