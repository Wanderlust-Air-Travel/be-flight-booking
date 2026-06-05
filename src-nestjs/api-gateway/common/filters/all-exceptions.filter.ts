import {
    type ArgumentsHost,
    Catch,
    type ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - uuid package is ESM but works fine with CommonJS
import { v7 as uuidv7 } from 'uuid';

interface HttpExceptionResponse {
    error?: string;
    message?: string | string[];
    status?: string;
    info?: unknown;
    details?: unknown;
}

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

        const rawResponse =
            exception instanceof HttpException
                ? exception.getResponse()
                : exception instanceof Error
                  ? exception.message
                  : 'Internal server error';

        const requestId =
            (request as unknown as { requestId?: string }).requestId ||
            request.headers['x-request-id'] ||
            request.headers['x-correlation-id'] ||
            uuidv7();

        response.setHeader('X-Request-Id', requestId as string);
        response.setHeader('X-Correlation-Id', requestId as string);

        const errorLog = {
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
            requestId,
            message:
                typeof rawResponse === 'string'
                    ? rawResponse
                    : (rawResponse as HttpExceptionResponse).message || rawResponse,
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

        const messageObj =
            typeof rawResponse === 'string' ? null : (rawResponse as HttpExceptionResponse);

        const errorResponse: Record<string, unknown> = {
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
            requestId,
        };

        const isHealthResponse =
            messageObj &&
            typeof messageObj === 'object' &&
            (messageObj.status === 'ok' || messageObj.status === 'error') &&
            (messageObj.info !== undefined || messageObj.details !== undefined);

        if (messageObj && (messageObj.error || messageObj.message)) {
            errorResponse.error = messageObj.error || 'Bad Request';
            errorResponse.message = messageObj.message;
        } else if (isHealthResponse) {
            errorResponse.message = messageObj;
        } else {
            const errorMessage = messageObj?.message
                ? Array.isArray(messageObj.message)
                    ? messageObj.message
                    : [messageObj.message]
                : typeof rawResponse === 'string'
                  ? rawResponse
                  : 'An error occurred';
            errorResponse.message = errorMessage;
        }

        if (process.env.NODE_ENV === 'development' && exception instanceof Error) {
            errorResponse.stack = exception.stack;
        }

        response.status(status).json(errorResponse);
    }
}
