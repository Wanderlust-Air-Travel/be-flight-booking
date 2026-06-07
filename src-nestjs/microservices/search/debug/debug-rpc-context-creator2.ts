import { Logger } from '@nestjs/common';
import { RpcContextCreator } from '@nestjs/microservices/context/rpc-context-creator';

const logger = new Logger('DebugRpcContextCreator2');

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
    logger.debug(`[DEBUG] RpcContextCreator.create: ${methodName}`);
    
    // Call original create
    const result = originalCreate.call(this, instance, callback, moduleKey, methodName, contextId, inquirerId, defaultCallMetadata);
    
    // result is a function: async (...args) => intercept(...)
    // We need to wrap the returned function to add logging around fnApplyPipes
    
    // But we can't easily access fnApplyPipes from outside
    // So instead, let's patch the callback's apply to see what's passed
    const originalCallbackApply = callback.apply;
    
    callback.apply = function(this: any, context: any, args: any[]) {
        logger.debug(`[DEBUG] FINAL callback.apply for ${methodName}`);
        logger.debug(`[DEBUG] callback.apply - args count: ${args?.length || 0}`);
        for (let i = 0; i < (args?.length || 0); i++) {
            const arg = args[i];
            const argType = typeof arg;
            if (argType === 'function') {
                logger.debug(`[DEBUG] callback.apply arg[${i}]: FUNCTION (name=${arg.name || 'anonymous'})`);
            } else if (argType === 'undefined') {
                logger.debug(`[DEBUG] callback.apply arg[${i}]: undefined`);
            } else if (argType === 'object' && arg !== null) {
                logger.debug(`[DEBUG] callback.apply arg[${i}]: OBJECT - ${JSON.stringify(arg).substring(0, 100)}`);
            } else {
                logger.debug(`[DEBUG] callback.apply arg[${i}]: ${argType} - ${String(arg).substring(0, 100)}`);
            }
        }
        return originalCallbackApply.call(callback, context, args);
    };
    
    return result;
} as any;

logger.log('[DebugRpcContextCreator2] RPC context creator debug logging v2 applied');
