import { Logger } from '@nestjs/common';
import { InterceptorsConsumer } from '@nestjs/core/interceptors/interceptors-consumer';

const logger = new Logger('DebugInterceptorsConsumer');

const originalIntercept = InterceptorsConsumer.prototype.intercept;

InterceptorsConsumer.prototype.intercept = async function(
    interceptors: any[],
    args: any[],
    instance: any,
    callback: Function,
    next: Function,
    type?: string
) {
    logger.debug(`[DEBUG] InterceptorsConsumer.intercept called`);
    logger.debug(`  args: ${args?.map((a, i) => `arg[${i}]: ${typeof a === 'function' ? 'FUNCTION' : JSON.stringify(a)}`).join(', ')}`);
    logger.debug(`  callback: ${typeof callback}`);
    logger.debug(`  next: ${typeof next}`);
    logger.debug(`  next.length: ${typeof next === 'function' ? next.length : 'N/A'}`);
    
    const result = originalIntercept.apply(this, [interceptors, args, instance, callback, next, type]);
    
    return result;
};

export {};
