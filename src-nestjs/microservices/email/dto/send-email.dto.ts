import { IsEmail, IsNotEmpty, IsString, IsOptional, IsEnum, ValidateIf } from 'class-validator';
import { EmailTemplate } from 'src/shared/constants/enums';

export class SendEmailDto {
	@IsEmail()
	@IsNotEmpty()
	to!: string;

	@IsString()
	@IsNotEmpty()
	@ValidateIf((o) => !o.template)
	subject?: string;

	@IsString()
	@IsNotEmpty()
	@ValidateIf((o) => !o.template)
	htmlBody?: string;

	@IsString()
	@IsOptional()
	textBody?: string;

	@IsEnum(EmailTemplate)
	@IsOptional()
	template?: EmailTemplate;

	@IsOptional()
	templateData?: Record<string, any>;

	@IsEmail()
	@IsOptional()
	replyTo?: string;

	@IsOptional()
	attachments?: string[]; // Array of file paths to attach
}

