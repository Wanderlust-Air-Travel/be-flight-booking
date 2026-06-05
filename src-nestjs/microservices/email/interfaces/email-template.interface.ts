/**
 * Interface for email template rendering result
 */
export interface TemplateResult {
    subject: string;
    htmlBody: string;
    textBody?: string;
}
