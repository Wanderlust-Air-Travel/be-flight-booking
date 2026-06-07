import { Logger } from '@nestjs/common';
import { RpcProxy } from '@nestjs/microservices/context/rpc-proxy';

const logger = new Logger('DebugRpcProxy');

const originalCreate = RpcProxy.prototype.create;

(RpcProxy.prototype as any).create = function(
    targetCallback: (...args: any[]) => Promise<any>, 
    exceptionsHandler: any
) {
    logger.debug(`[DebugRpcProxy] create called`);
    logger.debug(`  targetCallback: ${typeof targetCallback}`);
    logger.debug(`  targetCallback.length: ${targetCallback?.length}`);
    
    const wrappedCallback = async (...args: any[]) => {
        logger.debug(`[DebugRpcProxy] wrappedCallback called with ${args.length} args`);
        for (let i = 0; i < args.length; i++) {
            logger.debug(`  args[${i}]: type=${typeof args[i]}, isFunction=${typeof args[i] === 'function'}`);
        }
        
        try {
            logger.debug(`[DebugRpcProxy] Calling targetCallback with ${args.length} args...`);
            const result = await targetCallback(...args);
            logger.debug(`[DebugRpcProxy] targetCallback returned successfully`);
            return result;
        } catch (error) {
            logger.debug(`[DebugRpcProxy] targetCallback threw error`);
            throw error;
        }
    };
    
    return originalCreate.call(this, wrappedCallback, exceptionsHandler);
};

export {};
