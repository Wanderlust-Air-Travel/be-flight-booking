import { Logger } from '@nestjs/common';
import { InterceptorsConsumer } from '@nestjs/core/interceptors/interceptors-consumer';
import { isEmpty } from '@nestjs/common/utils/shared.utils';
import { AsyncResource } from 'async_hooks';
import { defer, from } from 'rxjs';
import { mergeAll, switchMap } from 'rxjs/operators';

const logger = new Logger('FixedInterceptorsConsumer');

/**
 * Fix for NestJS v11 RPC interceptor bug.
 * 
 * The bug: In InterceptorsConsumer.intercept(), when there are no interceptors,
 * `next()` is called without passing the RPC arguments (args array).
 * This causes the RPC handler to receive `undefined` instead of the actual payload.
 * 
 * The fix: We override the intercept method to ensure that when calling next(),
 * we pass:
 *   - initialArgs: the empty array where resolved parameters should be placed
 *   - args: the original RPC args [packetData, tcpContext]
 * 
 * This ensures that fnApplyPipes receives the correct arguments to extract the payload.
 */

// Override the intercept method
InterceptorsConsumer.prototype.intercept = async function(
    interceptors: any[],
    args: any[],
    instance: any,
    callback: Function,
    next: Function,
    type?: string
) {
    logger.debug(`[FixedInterceptorsConsumer] intercept called with ${args?.length || 0} args`);
    
    // When no interceptors, we need to call next with:
    // - initialArgs: empty array that will be filled with resolved params
    // - args: original RPC args [packetData, tcpContext]
    if (isEmpty(interceptors)) {
        logger.debug(`[FixedInterceptorsConsumer] No interceptors, calling next(initialArgs=[], args=[packetData, tcpContext])`);
        
        // Create an empty initialArgs array that will be filled by fnApplyPipes
        const initialArgs: any[] = [];
        const rpcArgs = args || [];
        
        return (next as any)(initialArgs, rpcArgs);
    }
    
    const context = this.createContext(args, instance, callback);
    context.setType(type);
    
    const nextFn = async (i = 0) => {
        if (i >= interceptors.length) {
            // Final handler - pass initialArgs and args
            logger.debug(`[FixedInterceptorsConsumer] Final handler with initialArgs and ${args?.length || 0} args`);
            const initialArgs: any[] = [];
            return defer(AsyncResource.bind(() => {
                // Call the original transformDeferred but with args
                const result = (next as any)(initialArgs, args);
                return from(result).pipe(switchMap((res: any) => {
                    const isDeferred = res instanceof Promise || (res && res.subscribe);
                    return isDeferred ? res : Promise.resolve(res);
                }));
            }));
        }
        
        const handler = {
            handle: () => defer(AsyncResource.bind(() => nextFn(i + 1))).pipe(mergeAll()),
        };
        return interceptors[i].intercept(context, handler);
    };
    
    return defer(() => nextFn()).pipe(mergeAll());
} as any;

logger.log('[FixedInterceptorsConsumer] RPC interceptor fix applied - passes initialArgs and args correctly');

export {};
