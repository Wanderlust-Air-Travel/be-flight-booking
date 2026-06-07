import { Logger } from '@nestjs/common';
import { PARAMTYPES_METADATA } from '@nestjs/common/constants';
import { RpcContextCreator } from '@nestjs/microservices/context/rpc-context-creator';
import { ContextUtils } from '@nestjs/core/helpers/context-utils';

const logger = new Logger('DebugRpcContextCreator');

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
    const originalCallbackApply = callback.apply;
    
    // Log the original callback's apply
    (callback as any).apply = function(this: any, context: any, args: any[]) {
        logger.debug(`[DEBUG] callback.apply invoked for ${methodName}`);
        logger.debug(`[DEBUG] callback.apply - this: ${context?.constructor?.name}`);
        logger.debug(`[DEBUG] callback.apply - args count: ${args?.length || 0}`);
        args?.forEach((arg: any, i: number) => {
            const argType = typeof arg;
            if (argType === 'function') {
                logger.debug(`[DEBUG] callback.apply arg[${i}]: FUNCTION (${arg.name || 'anonymous'})`);
            } else if (argType === 'undefined') {
                logger.debug(`[DEBUG] callback.apply arg[${i}]: undefined`);
            } else if (argType === 'object' && arg !== null) {
                logger.debug(`[DEBUG] callback.apply arg[${i}]: OBJECT - ${JSON.stringify(arg)}`);
            } else {
                logger.debug(`[DEBUG] callback.apply arg[${i}]: ${argType} - ${String(arg)}`);
            }
        });
        return originalCallbackApply.call(callback, context, args);
    };
    
    // Get paramtypes for logging
    const paramtypes = Reflect.getMetadata(PARAMTYPES_METADATA, instance, callback.name);
    logger.debug(`[DEBUG] RpcContextCreator.create: ${methodName}`);
    logger.debug(`[DEBUG] paramtypes for callback ${callback.name}: ${JSON.stringify(paramtypes)}`);
    
    const result = originalCreate.call(this, instance, callback, moduleKey, methodName, contextId, inquirerId, defaultCallMetadata);
    
    // Wrap the result to log when it's called
    if (typeof result === 'function') {
        const originalResult = result;
        return async function(this: any, ...args: any[]) {
            logger.debug(`[DEBUG] RPC proxy function called with ${args.length} args`);
            args.forEach((arg: any, i: number) => {
                const argType = typeof arg;
                if (argType === 'function') {
                    logger.debug(`[DEBUG] RPC proxy arg[${i}]: FUNCTION (${arg.name || 'anonymous'})`);
                } else if (argType === 'undefined') {
                    logger.debug(`[DEBUG] RPC proxy arg[${i}]: undefined`);
                } else if (argType === 'object' && arg !== null) {
                    logger.debug(`[DEBUG] RPC proxy arg[${i}]: OBJECT - ${JSON.stringify(arg).substring(0, 200)}`);
                } else {
                    logger.debug(`[DEBUG] RPC proxy arg[${i}]: ${argType} - ${String(arg)}`);
                }
            });
            return originalResult.apply(this, args);
        };
    }
    
    return result;
} as any;

logger.log('[DebugRpcContextCreator] RPC context creator debug logging applied');
