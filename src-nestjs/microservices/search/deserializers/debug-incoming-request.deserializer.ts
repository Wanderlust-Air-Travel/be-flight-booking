import { Logger } from '@nestjs/common';
import { isUndefined } from '@nestjs/common/utils/shared.utils';

/**
 * Debug deserializer to trace TCP message deserialization
 */
export class DebugIncomingRequestDeserializer {
    private readonly logger = new Logger(DebugIncomingRequestDeserializer.name);

    deserialize(value: any, options?: any) {
        this.logger.debug(`[DEBUG] deserialize called with value type: ${typeof value}`);
        this.logger.debug(`[DEBUG] deserialize value: ${JSON.stringify(value)}`);
        this.logger.debug(`[DEBUG] deserialize options: ${JSON.stringify(options)}`);

        const result = this.isExternal(value) ? this.mapToSchema(value, options) : value;
        
        this.logger.debug(`[DEBUG] deserialize result: ${JSON.stringify(result)}`);
        return result;
    }

    isExternal(value: any): boolean {
        this.logger.debug(`[DEBUG] isExternal check - value: ${JSON.stringify(value)}`);
        
        if (!value) {
            this.logger.debug('[DEBUG] isExternal: true (value is falsy)');
            return true;
        }
        
        const patternUndefined = isUndefined(value.pattern);
        const dataUndefined = isUndefined(value.data);
        
        this.logger.debug(`[DEBUG] isExternal check - pattern undefined: ${patternUndefined}, data undefined: ${dataUndefined}`);
        
        if (!patternUndefined || !dataUndefined) {
            this.logger.debug('[DEBUG] isExternal: false (pattern or data is defined)');
            return false;
        }
        
        this.logger.debug('[DEBUG] isExternal: true');
        return true;
    }

    mapToSchema(value: any, options?: any): any {
        this.logger.debug(`[DEBUG] mapToSchema called - value: ${JSON.stringify(value)}, options: ${JSON.stringify(options)}`);
        
        if (!options) {
            this.logger.warn('[DEBUG] mapToSchema: options is null/undefined, returning undefined for pattern and data!');
            return {
                pattern: undefined,
                data: undefined,
            };
        }
        
        return {
            pattern: options.channel,
            data: value,
        };
    }
}
