import {
    BadRequestException,
    Body,
    Controller,
    Get,
    HttpCode,
    HttpException,
    HttpStatus,
    Param,
    Post,
    Req,
    ServiceUnavailableException,
    UseGuards,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { firstValueFrom } from 'rxjs';
import { EMAIL_MS } from 'src/microservices/email/email.messages';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { EmailResponseDto } from './dto/email-response.dto';
import type { SendEmailDto } from './dto/send-email.dto';

@ApiTags('emails')
@Controller('emails')
export class EmailController {
    private get client(): ClientProxy {
        return this._client;
    }

    constructor(@Inject('EMAIL_CLIENT') private readonly _client: ClientProxy) {}

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
    async sendEmail(
        @Req() req: Request,
        @Body() dto: SendEmailDto
    ): Promise<EmailResponseDto> {
        // Fallback: if NestJS injects the DTO class instead of an instance, read from req.body
        const body = typeof dto === 'function' ? req.body : dto;

        try {
            // Validate: if template is provided, templateData should also be provided
            if (body.template && !body.templateData) {
                throw new BadRequestException('templateData is required when template is provided');
            }
            // Validate: if template is not provided, subject and htmlBody/textBody should be provided
            if (!body.template && !body.subject && !body.htmlBody && !body.textBody) {
                throw new BadRequestException(
                    'Either template with templateData, or subject with htmlBody/textBody must be provided'
                );
            }

            return await firstValueFrom(
                this.client.send<EmailResponseDto>(EMAIL_MS.PATTERN.SEND_EMAIL, body)
            );
        } catch (error: any) {
            // Re-throw HttpException instances (BadRequestException, NotFoundException, etc.)
            if (error instanceof HttpException) {
                throw error;
            }

            // Also check for statusCode property for compatibility
            if (error?.statusCode && error?.message) {
                throw error;
            }

            // Handle microservice connection errors - these are infrastructure issues (503)
            const errorMessage = error?.message || error?.toString() || '';
            const errorCode = error?.code || '';

            if (
                errorCode === 'ECONNREFUSED' ||
                errorMessage.includes('ECONNREFUSED') ||
                errorMessage.includes('Connection closed') ||
                errorCode === 'ETIMEDOUT' ||
                errorMessage.includes('timeout') ||
                errorMessage.includes('ETIMEDOUT')
            ) {
                throw new ServiceUnavailableException(
                    'Email microservice is not available. Please ensure the service is running.'
                );
            }

            // Generic error fallback
            throw new BadRequestException(
                `Failed to send email: ${errorMessage || 'Unknown error'}`
            );
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
            // Validate emailId format (should be UUID v7)
            const uuidRegex =
                /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(emailId)) {
                throw new BadRequestException('Invalid email ID format. Expected UUID v7.');
            }

            const result = await firstValueFrom(
                this.client.send<EmailResponseDto | null>(EMAIL_MS.PATTERN.GET_EMAIL_STATUS, {
                    emailId,
                })
            );

            if (!result) {
                throw new BadRequestException('Email not found');
            }

            return result;
        } catch (error: any) {
            // Re-throw HttpException instances (BadRequestException, NotFoundException, etc.)
            if (error instanceof HttpException) {
                throw error;
            }

            // Also check for statusCode property for compatibility
            if (error?.statusCode && error?.message) {
                throw error;
            }

            // Handle microservice connection errors - these are infrastructure issues (503)
            const errorMessage = error?.message || error?.toString() || '';
            const errorCode = error?.code || '';

            if (
                errorCode === 'ECONNREFUSED' ||
                errorMessage.includes('ECONNREFUSED') ||
                errorMessage.includes('Connection closed') ||
                errorCode === 'ETIMEDOUT' ||
                errorMessage.includes('timeout') ||
                errorMessage.includes('ETIMEDOUT')
            ) {
                throw new ServiceUnavailableException(
                    'Email microservice is not available. Please ensure the service is running.'
                );
            }

            // Generic error fallback
            throw new BadRequestException(
                `Failed to get email status: ${errorMessage || 'Unknown error'}`
            );
        }
    }

    @Get('health')
    @ApiOperation({
        summary: 'Health check',
        description:
            'Check the health status of the Email Service. Public endpoint (no authentication required).',
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
            // Re-throw HttpException instances
            if (error instanceof HttpException) {
                throw error;
            }

            // Handle microservice connection errors
            const errorMessage = error?.message || error?.toString() || '';
            const errorCode = error?.code || '';

            if (
                errorCode === 'ECONNREFUSED' ||
                errorMessage.includes('ECONNREFUSED') ||
                errorMessage.includes('Connection closed') ||
                errorCode === 'ETIMEDOUT' ||
                errorMessage.includes('timeout') ||
                errorMessage.includes('ETIMEDOUT')
            ) {
                throw new ServiceUnavailableException(
                    'Email microservice is not available. Please ensure the service is running.'
                );
            }

            throw error;
        }
    }
}
