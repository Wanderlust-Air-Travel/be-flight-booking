import {
    type CallHandler,
    type ExecutionContext,
    Injectable,
    Logger,
    type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger(LoggingInterceptor.name);

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const request = context.switchToHttp().getRequest<{
            method: string;
            url: string;
            requestId?: string;
        }>();
        const { method, url } = request;
        const requestId = request.requestId || 'unknown';

        const now = Date.now();

        const shouldLog = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

        return next.handle().pipe(
            tap(() => {
                const response = context.switchToHttp().getResponse<{ statusCode: number }>();
                const delay = Date.now() - now;

                if (shouldLog || response.statusCode >= 400) {
                    this.logger.log(
                        `${method} ${url} ${response.statusCode} - ${delay}ms [Request ID: ${requestId}]`
                    );
                }
            }),
            catchError((error) => {
                const delay = Date.now() - now;
                const status = error?.status || error?.statusCode || 500;
                this.logger.error(
                    `${method} ${url} ${status} - ${delay}ms [Request ID: ${requestId}]`,
                    error?.stack || error?.message
                );
                return throwError(() => error);
            })
        );
    }
}
