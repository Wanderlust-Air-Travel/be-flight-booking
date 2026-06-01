import { v7 as uuidv7 } from 'uuid';

/**
 * Helper utility for managing guest session IDs
 * Guest users use session IDs instead of user IDs for booking state management
 */
export class SessionHelper {
	/**
	 * Generate a unique session ID for guest users
	 * Format: UUID v7 (time-based, sortable)
	 */
	static generateSessionId(): string {
		return uuidv7();
	}

	/**
	 * Determine if an identifier is a session ID (guest) or user ID (authenticated)
	 * Session IDs are UUIDs, user IDs are also UUIDs, but we can distinguish by context
	 * For now, we'll use a simple check: if it's provided as sessionId, it's a session
	 * Otherwise, we assume it's a userId
	 * 
	 * @param identifier - Either userId or sessionId
	 * @param isGuest - Whether this is a guest user
	 * @returns The identifier to use for Redis key
	 */
	static getStateIdentifier(userId: string | null, sessionId: string | null): string {
		// If user is authenticated, use userId
		if (userId) {
			return userId;
		}
		// If guest user, use sessionId (must be provided)
		if (sessionId) {
			return sessionId;
		}
		// If neither provided, generate a new session ID for guest
		return this.generateSessionId();
	}

	/**
	 * Check if an identifier is a guest session (not a user ID)
	 * This is used to determine if we should use session-based state
	 */
	static isGuestSession(identifier: string, userId: string | null): boolean {
		return !userId && !!identifier;
	}
}

