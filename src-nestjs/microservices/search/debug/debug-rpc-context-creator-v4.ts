import { Logger } from '@nestjs/common';
import { PARAMTYPES_METADATA } from '@nestjs/common/constants';
import { RpcContextCreator } from '@nestjs/microservices/context/rpc-context-creator';

const logger = new Logger('DebugRpcContextCreatorV4');

const originalCreate = RpcContextCreator.prototype.create;

RpcContextCreator.prototype.create = function(
    instance: any,
    callback: Function,
    moduleKey: string,
    methodName: string,
    contextId?: any,
    inquirerId?: string,
    defaultCallMetadata?: any
) {
    const self = this as any;
    
    // Patch createPipesFn to add detailed logging
    const originalCreatePipesFn = self.createPipesFn;
    self.createPipesFn = function(pipes: any[], paramsOptions: any[]) {
        logger.debug(`[V4] createPipesFn for ${methodName} - paramsOptions length: ${paramsOptions?.length || 0}`);
        
        const result = originalCreatePipesFn.call(self, pipes, paramsOptions);
        
        if (!result) {
            logger.debug(`[V4] createPipesFn returned null for ${methodName}`);
            return null;
        }
        
        // Wrap the pipesFn to add detailed logging
        const originalPipesFn = result;
        return async function(args: any[], ...params: any[]) {
            logger.debug(`[V4] pipesFn EXECUTING for ${methodName}`);
            logger.debug(`[V4] pipesFn - args (before): length=${args.length}`);
            for (let i = 0; i < args.length; i++) {
                const a = args[i];
                logger.debug(`[V4] pipesFn - args[${i}] BEFORE: type=${typeof a}, ${typeof a === 'function' ? 'FUNCTION' : typeof a === 'undefined' ? 'undefined' : JSON.stringify(a)?.substring(0, 50)}`);
            }
            logger.debug(`[V4] pipesFn - params: length=${params.length}`);
            for (let i = 0; i < params.length; i++) {
                const p = params[i];
                logger.debug(`[V4] pipesFn - params[${i}]: type=${typeof p}, ${typeof p === 'function' ? 'FUNCTION' : typeof p === 'undefined' ? 'undefined' : typeof p === 'object' ? 'OBJECT' : String(p).substring(0, 50)}`);
            }
            
            // Call original pipesFn
            await originalPipesFn.call(this, args, ...params);
            
            logger.debug(`[V4] pipesFn - args (AFTER): length=${args.length}`);
            for (let i = 0; i < args.length; i++) {
                const a = args[i];
                logger.debug(`[V4] pipesFn - args[${i}] AFTER: type=${typeof a}, ${typeof a === 'function' ? 'FUNCTION' : typeof a === 'undefined' ? 'undefined' : JSON.stringify(a)?.substring(0, 50)}`);
            }
        };
    };
    
    // Patch the handler creation to log
    const originalResult = originalCreate.call(self, instance, callback, moduleKey, methodName, contextId, inquirerId, defaultCallMetadata);
    
    // Wrap the returned function to add logging
    if (typeof originalResult === 'function') {
        const wrapped = async function(this: any, ...args: any[]) {
            logger.debug(`[V4] RPC proxy wrapper called for ${methodName} with ${args.length} args`);
            return originalResult.apply(this, args);
        };
        return wrapped;
    }
    
    return originalResult;
} as any;

logger.log('[DebugRpcContextCreatorV4] RPC context creator v4 with detailed pipesFn logging applied');
