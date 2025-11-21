import {
	ExceptionFilter,
	Catch,
	ArgumentsHost,
	HttpException,
	HttpStatus,
	Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
	private readonly logger = new Logger(AllExceptionsFilter.name);

	catch(exception: unknown, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest<Request>();

		const status =
			exception instanceof HttpException
				? exception.getStatus()
				: HttpStatus.INTERNAL_SERVER_ERROR;

		const message =
			exception instanceof HttpException
				? exception.getResponse()
				: exception instanceof Error
					? exception.message
					: 'Internal server error';

		// Extract request ID if available
		const requestId = (request as any).requestId || 'unknown';

		// Log error with context
		const errorLog = {
			statusCode: status,
			timestamp: new Date().toISOString(),
			path: request.url,
			method: request.method,
			requestId,
			message: typeof message === 'string' ? message : (message as any).message || message,
			stack: exception instanceof Error ? exception.stack : undefined,
			body: request.body,
			query: request.query,
			params: request.params,
		};

		if (status >= 500) {
			this.logger.error('Internal Server Error', JSON.stringify(errorLog, null, 2));
		} else {
			this.logger.warn('Client Error', JSON.stringify(errorLog, null, 2));
		}

		// Format response
		const errorResponse = {
			statusCode: status,
			timestamp: new Date().toISOString(),
			path: request.url,
			method: request.method,
			requestId,
			message:
				typeof message === 'string'
					? message
					: (message as any).message || 'An error occurred',
			...(process.env.NODE_ENV === 'development' && {
				stack: exception instanceof Error ? exception.stack : undefined,
			}),
		};

		response.status(status).json(errorResponse);
	}
}

