import {
	ExceptionFilter,
	Catch,
	ArgumentsHost,
	HttpException,
	HttpStatus,
	Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - uuid package is ESM but works fine with CommonJS
import { v7 as uuidv7 } from 'uuid';

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

		// Extract or generate request ID
		// Try to get from request (set by RequestIdInterceptor) or headers, or generate new one
		let requestId = (request as any).requestId 
			|| request.headers['x-request-id'] 
			|| request.headers['x-correlation-id']
			|| uuidv7();
		
		// Ensure headers are set (even if interceptor didn't run due to early guard failure)
		response.setHeader('X-Request-Id', requestId);
		response.setHeader('X-Correlation-Id', requestId);

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
		// Handle ValidationPipe errors (BadRequestException with object response)
		const messageObj = typeof message === 'string' ? null : (message as any);
		
		const errorResponse: any = {
			statusCode: status,
			timestamp: new Date().toISOString(),
			path: request.url,
			method: request.method,
			requestId,
		};

		// Check if messageObj is a health response (has 'status', 'info', 'details' fields)
		const isHealthResponse = messageObj && typeof messageObj === 'object' 
			&& (messageObj.status === 'ok' || messageObj.status === 'error')
			&& (messageObj.info !== undefined || messageObj.details !== undefined);

		// If ValidationPipe error, preserve error structure but add required fields
		if (messageObj && (messageObj.error || messageObj.message)) {
			errorResponse.error = messageObj.error || 'Bad Request';
			errorResponse.message = messageObj.message;
		} else if (isHealthResponse) {
			// Preserve health response structure
			errorResponse.message = messageObj;
		} else {
			// Default error message
			const errorMessage = messageObj?.message 
				? (Array.isArray(messageObj.message) ? messageObj.message : [messageObj.message])
				: (typeof message === 'string' ? message : 'An error occurred');
			errorResponse.message = errorMessage;
		}

		// Add stack in development
		if (process.env.NODE_ENV === 'development' && exception instanceof Error) {
			errorResponse.stack = exception.stack;
		}

		response.status(status).json(errorResponse);
	}
}

