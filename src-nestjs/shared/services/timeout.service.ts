import { Injectable, Logger, RequestTimeoutException } from '@nestjs/common';
import { Observable, TimeoutError, throwError } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TimeoutService {
	private readonly logger = new Logger(TimeoutService.name);
	private readonly defaultTimeout: number;

	constructor(private readonly configService: ConfigService) {
		this.defaultTimeout = this.configService.get<number>('microservices.timeout', 5000);
	}

	withTimeout<T>(
		source: Observable<T>,
		customTimeout?: number,
		context?: string,
	): Observable<T> {
		const timeoutMs = customTimeout || this.defaultTimeout;
		return source.pipe(
			timeout(timeoutMs),
			catchError((error) => {
				if (error instanceof TimeoutError) {
					this.logger.error(
						`${context || 'Operation'} timed out after ${timeoutMs}ms`,
					);
					return throwError(
						() => new RequestTimeoutException(`Operation timed out after ${timeoutMs}ms`),
					);
				}
				return throwError(() => error);
			}),
		);
	}
}

