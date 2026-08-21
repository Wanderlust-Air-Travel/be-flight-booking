import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

interface RpcErrorResponse {
    statusCode?: number;
    message?: string;
    error?: string;
}

@Catch(RpcException)
export class RpcToHttpExceptionFilter implements ExceptionFilter {
    catch(exception: RpcException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const res = ctx.getResponse<{
            status: (code: number) => { json: (body: Record<string, unknown>) => void };
        }>();

        const error = exception.getError() as RpcErrorResponse;

        const statusCode: number =
            typeof error === 'object' && error?.statusCode
                ? error.statusCode
                : HttpStatus.BAD_GATEWAY;

        const message: string =
            typeof error === 'object' && error?.message
                ? error.message
                : (exception as unknown as { message?: string }).message || 'Service unavailable';

        const errorName: string =
            typeof error === 'object' && error?.error ? error.error : 'Bad Gateway';

        const body = {
            statusCode,
            message,
            error: errorName,
            timestamp: new Date().toISOString(),
        };

        res.status(statusCode).json(body);
    }
}
