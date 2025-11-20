import { IsEmail, IsNotEmpty, IsString, IsOptional, IsEnum, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmailTemplate } from 'src/shared/constants/enums';

export class SendEmailDto {
	@ApiProperty({ description: 'Recipient email address' })
	@IsEmail()
	@IsNotEmpty()
	to!: string;

	@ApiPropertyOptional({ description: 'Email subject (required if template not provided)' })
	@IsString()
	@IsNotEmpty()
	@ValidateIf((o) => !o.template)
	subject?: string;

	@ApiPropertyOptional({ description: 'Email body in HTML (required if template not provided)' })
	@IsString()
	@IsNotEmpty()
	@ValidateIf((o) => !o.template)
	htmlBody?: string;

	@ApiPropertyOptional({ description: 'Email body in plain text' })
	@IsString()
	@IsOptional()
	textBody?: string;

	@ApiPropertyOptional({
		description: 'Email template to use',
		enum: EmailTemplate,
	})
	@IsEnum(EmailTemplate)
	@IsOptional()
	template?: EmailTemplate;

	@ApiPropertyOptional({
		description: 'Template variables (for template-based emails)',
		type: Object,
	})
	@IsOptional()
	templateData?: Record<string, any>;

	@ApiPropertyOptional({ description: 'Reply-to email address' })
	@IsEmail()
	@IsOptional()
	replyTo?: string;
}

