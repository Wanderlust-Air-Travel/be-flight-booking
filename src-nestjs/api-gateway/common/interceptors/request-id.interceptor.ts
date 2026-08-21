import {
    type CallHandler,
    type ExecutionContext,
    Injectable,
    type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - uuid package is ESM but works fine with CommonJS
import { v7 as uuidv7 } from 'uuid';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const request = context.switchToHttp().getRequest<Record<string, unknown>>();
        const response = context
            .switchToHttp()
            .getResponse<{ setHeader: (key: string, val: string) => void }>();

        const requestId =
            (request.headers as Record<string, string>)['x-request-id'] ||
            (request.headers as Record<string, string>)['x-correlation-id'] ||
            uuidv7();

        request.requestId = requestId;

        response.setHeader('X-Request-Id', requestId);
        response.setHeader('X-Correlation-Id', requestId);

        return next.handle();
    }
}
