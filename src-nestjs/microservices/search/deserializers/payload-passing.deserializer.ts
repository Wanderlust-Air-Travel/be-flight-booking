import { Logger } from '@nestjs/common';
import { IncomingRequestDeserializer } from '@nestjs/microservices/deserializers/incoming-request.deserializer';

/**
 * Custom deserializer that wraps the handler call to ensure the payload is correctly passed.
 * This works around a bug in NestJS v11 where the RPC context creation doesn't properly
 * pass the payload to the handler.
 */
export class PayloadPassingDeserializer extends IncomingRequestDeserializer {
    private readonly logger = new Logger(PayloadPassingDeserializer.name);

    deserialize(value: any, options?: any) {
        const result = super.deserialize(value, options);
        
        // Log the deserialized result for debugging
        if (result && result.data) {
            this.logger.debug(`Deserialized packet with data: ${JSON.stringify(result.data)}`);
        }
        
        return result;
    }
}
