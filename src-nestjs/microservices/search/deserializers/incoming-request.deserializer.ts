import { Logger } from '@nestjs/common';
import { isUndefined } from '@nestjs/common/utils/shared.utils';

/**
 * Fixed deserializer for TCP microservices.
 *
 * ROOT CAUSE: The original DebugIncomingRequestDeserializer had a bug where
 * mapToSchema returned { pattern: undefined, data: undefined } when options was null/undefined.
 *
 * FIX: This fixed version:
 * 1. Checks if the incoming value already has pattern and data (already deserialized)
 * 2. If not, extracts pattern from options.channel (for TCP) or returns undefined
 * 3. Always preserves the data from the incoming value
 */
export class IncomingRequestDeserializer {
    private readonly logger = new Logger(IncomingRequestDeserializer.name);

    deserialize(value: any, options?: any): any {
        // If value is null/undefined, return it as-is
        if (value === null || value === undefined) {
            this.logger.warn('[Deserializer] Received null/undefined value');
            return { pattern: undefined, data: undefined };
        }

        // Check if value already has pattern and data (already in correct format)
        // This handles the case where the message comes pre-formatted with pattern/data
        const hasPattern = !isUndefined(value.pattern);
        const hasData = !isUndefined(value.data);

        if (hasPattern && hasData) {
            // Already in correct format - return as-is
            this.logger.debug(`[Deserializer] Message already has pattern and data`);
            return value;
        }

        // If we get here, the value needs to be transformed
        // For TCP, the pattern comes from options.channel, and data is the raw value
        this.logger.debug(
            `[Deserializer] Transforming message: hasPattern=${hasPattern}, hasData=${hasData}`
        );
        this.logger.debug(
            `[Deserializer] Value keys: ${Object.keys(value || {}).join(', ') || 'none'}`
        );
        this.logger.debug(`[Deserializer] Options type: ${typeof options}`);

        // Extract pattern from options if available
        const pattern = options?.channel;
        const data = value;

        if (!pattern) {
            this.logger.warn(`[Deserializer] No pattern found in options.channel`);
        }

        return {
            pattern,
            data,
        };
    }
}
