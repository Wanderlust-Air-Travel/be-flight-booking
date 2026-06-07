import { Deserializer } from '@nestjs/microservices/interfaces/deserializer.interface';
import { IncomingRequest, ReadPacket } from '@nestjs/microservices/interfaces/packet.interface';
import { isString } from '@nestjs/common/utils/shared.utils';

export class DebugIncomingRequestDeserializer implements Deserializer {
    deserialize(value: any, options?: any): ReadPacket<any> | IncomingRequest {
        console.log('[Deserializer] raw value:', JSON.stringify(value));
        console.log('[Deserializer] value type:', typeof value);
        console.log('[Deserializer] isExternal:', this.isExternal(value));

        // If already in proper format (from internal NestJS)
        if (!this.isExternal(value)) {
            console.log('[Deserializer] internal format, returning as-is');
            return value as IncomingRequest;
        }

        // External format
        if (!options) {
            console.log('[Deserializer] no options, returning undefined pattern/data');
            return {
                pattern: undefined,
                data: undefined,
            };
        }

        console.log('[Deserializer] mapping to schema with channel:', options.channel);
        return {
            pattern: options.channel,
            data: value,
        };
    }

    private isExternal(value: any): boolean {
        if (!value) return true;
        if (typeof value !== 'object') return true;
        // Has proper NestJS packet format?
        if (value.pattern !== undefined || value.data !== undefined) return false;
        // Has id (response format)?
        if (value.id !== undefined) return true;
        // Has pattern (maybe string pattern)?
        if (isString(value.pattern)) return false;
        // Has pattern as object?
        if (typeof value.pattern === 'object') return false;
        return true;
    }
}
