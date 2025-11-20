import { Controller, Post, Get, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import {
	ApiBadRequestResponse,
	ApiOkResponse,
	ApiOperation,
	ApiParam,
	ApiTags,
	ApiBearerAuth,
} from '@nestjs/swagger';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { SendEmailDto } from './dto/send-email.dto';
import { EmailResponseDto } from './dto/email-response.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { EMAIL_MS } from 'src/microservices/email/email.messages';

@ApiTags('emails')
@Controller('emails')
export class EmailController {
	constructor(@Inject('EMAIL_CLIENT') private readonly client: ClientProxy) {}

	@Post('send')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth('access-token')
	@HttpCode(HttpStatus.ACCEPTED)
	@ApiOperation({
		summary: 'Send an email',
		description:
			'Send a single email. Email will be queued and processed asynchronously. Supports both custom emails and template-based emails. Requires JWT authentication.',
	})
	@ApiOkResponse({
		description: 'Email queued successfully',
		type: EmailResponseDto,
	})
	@ApiBadRequestResponse({
		description: 'Invalid request parameters or validation failed',
	})
	async sendEmail(@Body() dto: SendEmailDto): Promise<EmailResponseDto> {
		try {
			return await firstValueFrom(this.client.send<EmailResponseDto>(EMAIL_MS.PATTERN.SEND_EMAIL, dto));
		} catch (error: any) {
			throw error;
		}
	}

	@Get(':emailId/status')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth('access-token')
	@ApiOperation({
		summary: 'Get email status',
		description: 'Get the status of an email by email ID. Requires JWT authentication.',
	})
	@ApiParam({
		name: 'emailId',
		description: 'Email job ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Email status retrieved successfully',
		type: EmailResponseDto,
	})
	@ApiBadRequestResponse({
		description: 'Email not found',
	})
	async getEmailStatus(@Param('emailId') emailId: string): Promise<EmailResponseDto | null> {
		try {
			return await firstValueFrom(
				this.client.send<EmailResponseDto | null>(EMAIL_MS.PATTERN.GET_EMAIL_STATUS, { emailId }),
			);
		} catch (error: any) {
			throw error;
		}
	}

	@Get('health')
	@ApiOperation({
		summary: 'Health check',
		description: 'Check the health status of the Email Service. Public endpoint (no authentication required).',
	})
	@ApiOkResponse({
		description: 'Email service health status',
		schema: {
			type: 'object',
			properties: {
				status: { type: 'string', example: 'ok' },
				gmailReady: { type: 'boolean', example: true },
				queueStats: {
					type: 'object',
					properties: {
						total: { type: 'number', example: 10 },
						queued: { type: 'number', example: 2 },
						sending: { type: 'number', example: 1 },
						sent: { type: 'number', example: 6 },
						failed: { type: 'number', example: 1 },
						rateLimitRemaining: { type: 'number', example: 95 },
					},
				},
			},
		},
	})
	async healthCheck(): Promise<{
		status: string;
		gmailReady: boolean;
		queueStats: {
			total: number;
			queued: number;
			sending: number;
			sent: number;
			failed: number;
			rateLimitRemaining: number;
		};
	}> {
		try {
			return await firstValueFrom(this.client.send(EMAIL_MS.PATTERN.HEALTH_CHECK, {}));
		} catch (error: any) {
			throw error;
		}
	}
}

