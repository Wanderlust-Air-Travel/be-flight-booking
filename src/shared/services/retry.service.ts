import { Injectable, Logger } from '@nestjs/common';
import { Observable, timer, throwError } from 'rxjs';
import { retry, catchError, mergeMap } from 'rxjs/operators';

@Injectable()
export class RetryService {
	private readonly logger = new Logger(RetryService.name);

	retryWithBackoff<T>(
		source: Observable<T>,
		maxRetries = 3,
		initialDelay = 1000,
		context?: string,
	): Observable<T> {
		return source.pipe(
			retry({
				count: maxRetries,
				delay: (error, retryCount) => {
					const delayMs = initialDelay * Math.pow(2, retryCount - 1); // Exponential backoff
					this.logger.warn(
						`${context || 'Operation'} failed. Retrying after ${delayMs}ms (attempt ${retryCount}/${maxRetries})`,
						error?.message || error,
					);
					return timer(delayMs);
				},
			}),
			catchError((error) => {
				this.logger.error(
					`${context || 'Operation'} failed after ${maxRetries} retries: ${error.message}`,
					error.stack,
				);
				return throwError(() => error);
			}),
		);
	}
}

