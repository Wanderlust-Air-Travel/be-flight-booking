import { Logger } from '@nestjs/common';

// Monkey-patch the ServerTCP handleMessage method to add debug logging
import { ServerTCP } from '@nestjs/microservices/server/server-tcp';

const logger = new Logger('DebugServerTCP');

const originalHandleMessage = ServerTCP.prototype.handleMessage;

ServerTCP.prototype.handleMessage = async function(...args: any[]) {
    logger.debug(`[DEBUG] ServerTCP.handleMessage called`);
    logger.debug(`  args.length: ${args.length}`);
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg && typeof arg === 'object') {
            // Check if it looks like the packet
            if (arg.pattern !== undefined || arg.data !== undefined) {
                logger.debug(`  arg[${i}]: PACKET with pattern=${arg.pattern}, data=${JSON.stringify(arg.data)}`);
            } else {
                logger.debug(`  arg[${i}]: OBJECT (${Object.keys(arg).slice(0, 5).join(', ')}...)`);
            }
        } else if (typeof arg === 'function') {
            logger.debug(`  arg[${i}]: FUNCTION`);
        } else {
            logger.debug(`  arg[${i}]: ${typeof arg} = ${arg}`);
        }
    }
    
    return originalHandleMessage.apply(this, args);
};

// Also patch the handler registration
const originalAddHandler = ServerTCP.prototype.addHandler;
ServerTCP.prototype.addHandler = function(...args: any[]) {
    const pattern = args[0];
    const callback = args[1];
    logger.debug(`[DEBUG] ServerTCP.addHandler called for pattern: ${pattern}`);
    logger.debug(`  callback type: ${typeof callback}`);
    if (typeof callback === 'function') {
        logger.debug(`  callback.length (params count): ${callback.length}`);
    }
    return originalAddHandler.apply(this, args);
};

export {};
