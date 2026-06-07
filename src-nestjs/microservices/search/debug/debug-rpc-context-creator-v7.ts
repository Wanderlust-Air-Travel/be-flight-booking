import { Logger } from '@nestjs/common';
import { RpcContextCreator } from '@nestjs/microservices/context/rpc-context-creator';

const logger = new Logger('DebugRpcContextCreatorV7');

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
    
    // Patch createPipesFn to trace exact execution
    const originalCreatePipesFn = self.createPipesFn;
    self.createPipesFn = function(pipes: any[], paramsOptions: any[]) {
        logger.debug(`[V7] createPipesFn for ${methodName}`);
        
        const result = originalCreatePipesFn.call(self, pipes, paramsOptions);
        
        if (!result) {
            return null;
        }
        
        // Wrap to trace exact execution
        const originalPipesFn = result;
        return async function(this: any, args: any[], ...params: any[]) {
            logger.debug(`[V7] pipesFn executing for ${methodName}`);
            
            // Manually execute the logic from createPipesFn to trace it
            const resolveParamValue = async (param: any) => {
                const { index, extractValue, type, data, metatype, pipes: paramPipes } = param;
                
                // Step 1: Call extractValue
                const value = extractValue(...params);
                logger.debug(`[V7] param[${index}] extractValue returned: type=${typeof value}, isFunction=${typeof value === 'function'}`);
                
                // Step 2: Call pipesConsumer.apply and log what it returns
                const pipesConsumer = self.pipesConsumer;
                if (pipesConsumer && pipesConsumer.apply) {
                    logger.debug(`[V7] param[${index}] calling pipesConsumer.apply`);
                    const pipeResult = await pipesConsumer.apply(value, { metatype, type, data }, pipes.concat(paramPipes || []));
                    logger.debug(`[V7] param[${index}] pipesConsumer.apply returned: type=${typeof pipeResult}, isFunction=${typeof pipeResult === 'function'}`);
                    if (typeof pipeResult === 'function') {
                        logger.debug(`[V7] param[${index}] pipeResult function: ${pipeResult.toString().substring(0, 100)}`);
                    }
                    args[index] = pipeResult;
                } else {
                    args[index] = value;
                }
            };
            
            await Promise.all(paramsOptions.map(resolveParamValue));
            
            logger.debug(`[V7] args AFTER: ${args.map(a => typeof a === 'function' ? 'FUNCTION' : typeof a).join(', ')}`);
            if (typeof args[0] === 'function') {
                logger.debug(`[V7] args[0] function: ${args[0].toString().substring(0, 150)}`);
            }
        };
    };
    
    return originalCreate.call(self, instance, callback, moduleKey, methodName, contextId, inquirerId, defaultCallMetadata);
} as any;

logger.log('[DebugRpcContextCreatorV7] RPC context creator v7 with full param tracing applied');
