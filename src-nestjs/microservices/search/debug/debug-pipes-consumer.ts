import { Logger } from '@nestjs/common';
import { PipesConsumer } from '@nestjs/core/pipes/pipes-consumer';

const logger = new Logger('DebugPipesConsumer');

const originalApply = PipesConsumer.prototype.apply;
const originalApplyPipes = PipesConsumer.prototype.applyPipes;

PipesConsumer.prototype.apply = async function(
    value: any,
    { metatype, type, data }: { metatype: any; type: any; data: any },
    pipes: any[]
) {
    logger.debug(`[DEBUG PipesConsumer.apply]`);
    logger.debug(`[DEBUG] value type: ${typeof value}, isFunction: ${typeof value === 'function'}`);
    logger.debug(`[DEBUG] metatype: ${metatype}, type: ${type}, data: ${data}`);
    logger.debug(`[DEBUG] pipes count: ${pipes?.length || 0}`);
    if (pipes && pipes.length > 0) {
        pipes.forEach((pipe: any, i: number) => {
            logger.debug(`[DEBUG] pipe[${i}]: ${pipe?.constructor?.name || typeof pipe}`);
        });
    }
    
    const result = await originalApply.call(this, value, { metatype, type, data }, pipes);
    
    logger.debug(`[DEBUG PipesConsumer.apply] result type: ${typeof result}, isFunction: ${typeof result === 'function'}`);
    if (typeof result === 'function') {
        logger.debug(`[DEBUG] result function name: ${result.name || 'anonymous'}`);
    }
    return result;
};

PipesConsumer.prototype.applyPipes = async function(
    value: any,
    { metatype, type, data }: { metatype: any; type: any; data: any },
    transforms: any[]
) {
    logger.debug(`[DEBUG PipesConsumer.applyPipes]`);
    logger.debug(`[DEBUG] initial value type: ${typeof value}, isFunction: ${typeof value === 'function'}`);
    
    const result = await originalApplyPipes.call(this, value, { metatype, type, data }, transforms);
    
    logger.debug(`[DEBUG PipesConsumer.applyPipes] final result type: ${typeof result}, isFunction: ${typeof result === 'function'}`);
    if (typeof result === 'function') {
        logger.debug(`[DEBUG] final result function: ${result.name || 'anonymous'}`);
    }
    return result;
};

logger.log('[DebugPipesConsumer] PipesConsumer debug logging applied');
