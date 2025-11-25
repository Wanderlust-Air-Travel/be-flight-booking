import { Injectable, ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Observable } from "rxjs";

/**
 * Optional JWT Auth Guard
 * Extracts user from JWT token if present, but does not require authentication
 * This allows endpoints to work both with and without authentication
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
	canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
		// Always allow request to continue
		// Try to extract user from token, but don't fail if token is missing/invalid
		const result = super.canActivate(context);
		
		// If super.canActivate returns a Promise/Observable, catch errors and allow request
		if (result instanceof Promise) {
			return result.catch(() => true);
		}
		
		if (result instanceof Observable) {
			return new Observable(observer => {
				result.subscribe({
					next: (value) => observer.next(value),
					error: () => {
						// If authentication fails, allow request to continue
						observer.next(true);
						observer.complete();
					},
					complete: () => observer.complete(),
				});
			});
		}
		
		// If boolean, return true (allow request)
		return true;
	}

	handleRequest(err: any, user: any, info: any) {
		// If there's an error or no user, return undefined (not throw)
		// This allows the request to continue without authentication
		if (err || !user) {
			return undefined;
		}
		return user;
	}
}