import { ExceptionFilter, Catch, ArgumentsHost, BadRequestException } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
	catch(exception: BadRequestException, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest<Request>();
		const status = exception.getStatus();
		const exceptionResponse = exception.getResponse();

		// Log validation errors for debugging
		console.log('[DEBUG] Validation error:', {
			url: request.url,
			query: request.query,
			body: request.body,
			error: exceptionResponse,
		});

		response.status(status).json(exceptionResponse);
	}
}

