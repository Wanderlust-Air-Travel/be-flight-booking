import { v7 as uuidv7 } from 'uuid';

/**
 * Generate a unique session ID for guest users.
 * Format: UUID v7 (time-based, sortable)
 */
export function generateSessionId(): string {
    return uuidv7();
}

/**
 * Determine if an identifier is a session ID (guest) or user ID (authenticated).
 * Session IDs are UUIDs, user IDs are also UUIDs, but we can distinguish by context.
 * For now, we'll use a simple check: if it's provided as sessionId, it's a session.
 * Otherwise, we assume it's a userId.
 */
export function getStateIdentifier(userId: string | null, sessionId: string | null): string {
    if (userId) {
        return userId;
    }
    if (sessionId) {
        return sessionId;
    }
    return generateSessionId();
}

/**
 * Check if an identifier is a guest session (not a user ID).
 * This is used to determine if we should use session-based state.
 */
export function isGuestSession(identifier: string, userId: string | null): boolean {
    return !userId && !!identifier;
}
