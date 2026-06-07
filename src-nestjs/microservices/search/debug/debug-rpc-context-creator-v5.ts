import { Logger } from '@nestjs/common';
import { RpcContextCreator } from '@nestjs/microservices/context/rpc-context-creator';

const logger = new Logger('DebugRpcContextCreatorV5');

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
    
    // Patch createPipesFn to log EXACTLY what's happening
    const originalCreatePipesFn = self.createPipesFn;
    self.createPipesFn = function(pipes: any[], paramsOptions: any[]) {
        logger.debug(`[V5] createPipesFn called for ${methodName}`);
        logger.debug(`[V5] createPipesFn - paramsOptions: ${JSON.stringify(paramsOptions?.map((p: any) => ({ index: p?.index, type: p?.type, data: p?.data })))}`);
        
        const result = originalCreatePipesFn.call(self, pipes, paramsOptions);
        
        if (!result) {
            logger.debug(`[V5] createPipesFn returned null for ${methodName}`);
            return null;
        }
        
        // Wrap the pipesFn to add detailed logging
        const originalPipesFn = result;
        return async function(this: any, args: any[], ...params: any[]) {
            logger.debug(`[V5] pipesFn EXECUTING for ${methodName}`);
            logger.debug(`[V5] args === initialArgs? isArray=${Array.isArray(args)}, length=${args.length}`);
            logger.debug(`[V5] params.length = ${params.length}`);
            
            // Store original args values
            const originalArgsValues = [...args];
            logger.debug(`[V5] args BEFORE pipesFn: ${originalArgsValues.map((a: any) => typeof a === 'function' ? 'FUNCTION' : String(a).substring(0, 30)).join(', ')}`);
            
            // Call original pipesFn
            await originalPipesFn.call(this, args, ...params);
            
            logger.debug(`[V5] args AFTER pipesFn: ${args.map((a: any) => typeof a === 'function' ? 'FUNCTION' : typeof a === 'undefined' ? 'undefined' : JSON.stringify(a)?.substring(0, 50) || 'null').join(', ')}`);
            logger.debug(`[V5] args[0] === 'function'? ${typeof args[0] === 'function'}`);
            if (typeof args[0] === 'function') {
                logger.debug(`[V5] args[0] function name: ${args[0].name || 'anonymous'}`);
                logger.debug(`[V5] args[0] function length: ${args[0].length}`);
                logger.debug(`[V5] args[0] function toString().substring(0, 100): ${args[0].toString().substring(0, 100)}`);
            }
        };
    };
    
    const result = originalCreate.call(self, instance, callback, moduleKey, methodName, contextId, inquirerId, defaultCallMetadata);
    logger.debug(`[V5] RpcContextCreator.create returned ${typeof result} for ${methodName}`);
    
    return result;
} as any;

logger.log('[DebugRpcContextCreatorV5] RPC context creator v5 with exact mutation tracking applied');
