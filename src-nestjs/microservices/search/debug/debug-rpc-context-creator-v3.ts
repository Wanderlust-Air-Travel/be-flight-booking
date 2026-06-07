import { Logger } from '@nestjs/common';
import { PARAMTYPES_METADATA } from '@nestjs/common/constants';
import { RpcContextCreator } from '@nestjs/microservices/context/rpc-context-creator';

const logger = new Logger('DebugRpcContextCreatorV3');

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
    const self = this;
    
    // Get original createPipesFn reference
    const originalCreatePipesFn = (self as any).createPipesFn;
    
    // Patch createPipesFn to add logging
    (self as any).createPipesFn = function(pipes: any[], paramsOptions: any[]) {
        logger.debug(`[DEBUG] createPipesFn called for ${methodName} with ${paramsOptions?.length || 0} params`);
        
        const originalPipesFn = originalCreatePipesFn.call(self, pipes, paramsOptions);
        
        if (!originalPipesFn) {
            logger.debug(`[DEBUG] createPipesFn returned null (no pipes needed)`);
            return null;
        }
        
        // Wrap the pipesFn to add logging
        return async function(this: any, args: any[], ...params: any[]) {
            logger.debug(`[DEBUG] pipesFn called for ${methodName}`);
            logger.debug(`[DEBUG] pipesFn - args initial: length=${args.length}, values=[${args.map((a: any) => typeof a === 'function' ? 'FUNCTION' : typeof a === 'undefined' ? 'undefined' : 'object').join(', ')}]`);
            logger.debug(`[DEBUG] pipesFn - params: length=${params.length}`);
            params.forEach((p: any, i: number) => {
                const pType = typeof p;
                logger.debug(`[DEBUG] pipesFn - param[${i}]: type=${pType}, ${pType === 'object' ? JSON.stringify(p).substring(0, 100) : pType === 'function' ? 'FUNCTION' : p}`);
            });
            
            // Call original pipesFn
            await originalPipesFn.call(this, args, ...params);
            
            logger.debug(`[DEBUG] pipesFn - args after: length=${args.length}`);
            for (let i = 0; i < args.length; i++) {
                const a = args[i];
                const aType = typeof a;
                if (aType === 'function') {
                    logger.debug(`[DEBUG] pipesFn - args[${i}]: FUNCTION (name=${a.name || 'anonymous'})`);
                } else if (aType === 'undefined') {
                    logger.debug(`[DEBUG] pipesFn - args[${i}]: undefined`);
                } else if (aType === 'object' && a !== null) {
                    logger.debug(`[DEBUG] pipesFn - args[${i}]: OBJECT - ${JSON.stringify(a).substring(0, 100)}`);
                } else {
                    logger.debug(`[DEBUG] pipesFn - args[${i}]: ${aType} - ${String(a).substring(0, 100)}`);
                }
            }
        };
    };
    
    // Also patch the callback.apply to log what final args are received
    const originalCallbackApply = callback.apply;
    callback.apply = function(this: any, context: any, args: any[]) {
        logger.debug(`[DEBUG] FINAL callback.apply for ${methodName} with ${args?.length || 0} args`);
        for (let i = 0; i < (args?.length || 0); i++) {
            const arg = args[i];
            const argType = typeof arg;
            if (argType === 'function') {
                logger.debug(`[DEBUG] FINAL callback.apply arg[${i}]: FUNCTION (name=${arg.name || 'anonymous'})`);
            } else if (argType === 'undefined') {
                logger.debug(`[DEBUG] FINAL callback.apply arg[${i}]: undefined`);
            } else if (argType === 'object' && arg !== null) {
                logger.debug(`[DEBUG] FINAL callback.apply arg[${i}]: OBJECT - ${JSON.stringify(arg).substring(0, 100)}`);
            } else {
                logger.debug(`[DEBUG] FINAL callback.apply arg[${i}]: ${argType} - ${String(arg).substring(0, 100)}`);
            }
        }
        return originalCallbackApply.call(callback, context, args);
    };
    
    return originalCreate.call(self, instance, callback, moduleKey, methodName, contextId, inquirerId, defaultCallMetadata);
} as any;

logger.log('[DebugRpcContextCreatorV3] RPC context creator v3 with createPipesFn logging applied');
