import { v7 as uuid7 } from 'uuid';

/**
 * Generate a UUID v7 string.
 * Use this helper anywhere an application-generated id is required.
 */
export function generateId(): string {
    return uuid7();
}

export default generateId;
