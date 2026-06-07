import { Deserializer } from '@nestjs/microservices/interfaces/deserializer.interface';
import type { IncomingRequest, ReadPacket } from '@nestjs/microservices/interfaces/packet.interface';
import { isString, isUndefined } from '@nestjs/common/utils/shared.utils';

export class JsonIncomingRequestDeserializer implements Deserializer {
    deserialize(value: any, options?: any): ReadPacket<any> | IncomingRequest {
        // value may be Buffer from TCP socket
        let parsed: any;
        if (Buffer.isBuffer(value)) {
            const str = value.toString('utf8');
            // JsonSocket format: "<length>#<json>"
            const delimiterIdx = str.indexOf('#');
            if (delimiterIdx !== -1) {
                const lengthStr = str.substring(0, delimiterIdx);
                const length = parseInt(lengthStr, 10);
                const jsonStr = str.substring(delimiterIdx + 1);
                if (jsonStr.length === length) {
                    try {
                        parsed = JSON.parse(jsonStr);
                    } catch {
                        parsed = { pattern: undefined, data: undefined };
                    }
                } else {
                    parsed = { pattern: undefined, data: undefined };
                }
            } else {
                // Try direct JSON parse
                try {
                    parsed = JSON.parse(str);
                } catch {
                    parsed = { pattern: undefined, data: undefined };
                }
            }
        } else if (typeof value === 'string') {
            try {
                parsed = JSON.parse(value);
            } catch {
                parsed = { pattern: undefined, data: undefined };
            }
        } else {
            parsed = value;
        }

        // If already has proper packet format
        if (parsed && (parsed.pattern !== undefined || parsed.data !== undefined)) {
            return parsed as IncomingRequest;
        }

        // Fallback: treat value as data, use options.channel as pattern
        return {
            pattern: options?.channel,
            data: parsed,
        };
    }
}
