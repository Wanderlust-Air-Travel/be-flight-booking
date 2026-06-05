import { type ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Observable } from 'rxjs';

/**
 * Optional JWT Auth Guard
 * Extracts user from JWT token if present, but does not require authentication
 * This allows endpoints to work both with and without authentication
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        // Always allow authentication to proceed, even if it fails
        // Passport will call handleRequest which we override to not throw errors
        return super.canActivate(context);
    }

    handleRequest(err: any, user: any, _info: any, _context?: ExecutionContext) {
        // Don't throw error if authentication fails (missing/invalid token)
        // Instead, return undefined to allow request to continue without authentication
        // But if user exists, return it so Passport attaches it to req.user
        if (err) {
            // Authentication failed (missing token, invalid token, etc.)
            // Return undefined to allow unauthenticated access
            return undefined;
        }

        // Return user if exists, or undefined if not
        // This allows Passport to attach user to req.user when available
        return user || undefined;
    }
}
