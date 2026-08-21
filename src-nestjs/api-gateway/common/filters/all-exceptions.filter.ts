import {
    type ArgumentsHost,
    Catch,
    type ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
    ServiceUnavailableException,
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

interface MicroserviceError {
    code?: string;
    message?: string;
    statusCode?: number;
    status?: string;
}

/**
 * Map microservice / RxJS transport errors to the right HTTP status.
 */
function classifyMicroserviceError(exception: unknown): {
    status: number;
    exception: unknown;
} {
    const error = exception as MicroserviceError;
    const message: string = (error?.message || '').toString();
    const code: string = (error?.code || '').toString();

    // If NestJS already produced an HttpException, leave it alone.
    if (exception instanceof HttpException) {
        return { status: exception.getStatus(), exception };
    }

    if (code === 'ECONNREFUSED' || message.includes('ECONNREFUSED')) {
        return { status: HttpStatus.SERVICE_UNAVAILABLE, exception: new ServiceUnavailableException(message || 'Microservice unavailable') };
    }
    if (code === 'ECONNRESET' || message.includes('ECONNRESET')) {
        return { status: HttpStatus.SERVICE_UNAVAILABLE, exception: new ServiceUnavailableException(message || 'Microservice connection closed') };
    }
    if (message.includes('Connection closed')) {
        return { status: HttpStatus.SERVICE_UNAVAILABLE, exception: new ServiceUnavailableException(message) };
    }
    if (message.includes('InvalidTcpDataReceptionException') || message.includes('invalid received message from tcp server')) {
        return { status: HttpStatus.SERVICE_UNAVAILABLE, exception: new ServiceUnavailableException(message) };
    }
    if (code === 'ETIMEDOUT' || message.toLowerCase().includes('timeout')) {
        return { status: HttpStatus.SERVICE_UNAVAILABLE, exception: new ServiceUnavailableException(message || 'Microservice timeout') };
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, exception };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const { status, exception: classified } = classifyMicroserviceError(exception);

        const statusFromHttp =
            classified instanceof HttpException ? classified.getStatus() : status;

        const rawResponse =
            classified instanceof HttpException
                ? classified.getResponse()
                : classified instanceof Error
                  ? classified.message
                  : 'Internal server error';

        const requestId =
            (request as unknown as { requestId?: string }).requestId ||
            request.headers['x-request-id'] ||
            request.headers['x-correlation-id'] ||
            uuidv7();

        response.setHeader('X-Request-Id', requestId as string);
        response.setHeader('X-Correlation-Id', requestId as string);

        const errorLog = {
            statusCode: statusFromHttp,
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
            requestId,
            message:
                typeof rawResponse === 'string'
                    ? rawResponse
                    : (rawResponse as HttpExceptionResponse).message || rawResponse,
            stack: classified instanceof Error ? classified.stack : undefined,
            body: request.body,
            query: request.query,
            params: request.params,
        };

        if (statusFromHttp >= 500) {
            this.logger.error('Internal Server Error', JSON.stringify(errorLog, null, 2));
        } else {
            this.logger.warn('Client Error', JSON.stringify(errorLog, null, 2));
        }

        const messageObj =
            typeof rawResponse === 'string' ? null : (rawResponse as HttpExceptionResponse);

        const errorResponse: Record<string, unknown> = {
            statusCode: statusFromHttp,
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

        if (process.env.NODE_ENV === 'development' && classified instanceof Error) {
            errorResponse.stack = classified.stack;
        }

        response.status(statusFromHttp).json(errorResponse);
    }
}