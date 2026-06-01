import {
	Injectable,
	NestInterceptor,
	ExecutionContext,
	CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - uuid package is ESM but works fine with CommonJS
import { v7 as uuidv7 } from 'uuid';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const request = context.switchToHttp().getRequest();
		const response = context.switchToHttp().getResponse();

		// Get or generate request ID
		// Using UUID v7 (time-ordered) for consistency with database IDs
		// UUID v7 has timestamp embedded, making logs sortable by time
		const requestId =
			request.headers['x-request-id'] ||
			request.headers['x-correlation-id'] ||
			uuidv7();

		// Attach to request object
		(request as any).requestId = requestId;

		// Attach to response headers
		response.setHeader('X-Request-Id', requestId);
		response.setHeader('X-Correlation-Id', requestId);

		return next.handle();
	}
}

