import {
	Injectable,
	NestInterceptor,
	ExecutionContext,
	CallHandler,
	Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
	private readonly logger = new Logger(LoggingInterceptor.name);

	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const request = context.switchToHttp().getRequest();
		const { method, url, body, query, params } = request;
		const requestId = (request as any).requestId || 'unknown';

		const now = Date.now();

		this.logger.log(
			`→ ${method} ${url} [Request ID: ${requestId}]`,
			JSON.stringify({ query, params, body: this.sanitizeBody(body) }, null, 2),
		);

		return next.handle().pipe(
			tap(() => {
				const response = context.switchToHttp().getResponse();
				const delay = Date.now() - now;
				this.logger.log(
					`← ${method} ${url} ${response.statusCode} - ${delay}ms [Request ID: ${requestId}]`,
				);
			}),
			catchError((error) => {
				const delay = Date.now() - now;
				const status = error?.status || error?.statusCode || 500;
				this.logger.error(
					`✗ ${method} ${url} ${status} - ${delay}ms [Request ID: ${requestId}]`,
					error?.stack || error?.message,
				);
				return throwError(() => error);
			}),
		);
	}

	private sanitizeBody(body: any): any {
		if (!body) return body;
		const sanitized = { ...body };
		// Remove sensitive fields
		if (sanitized.password) sanitized.password = '***';
		if (sanitized.password_hash) sanitized.password_hash = '***';
		if (sanitized.refresh_token) sanitized.refresh_token = '***';
		return sanitized;
	}
}

