import { Logger } from '@nestjs/common';
import { RpcContextCreator } from '@nestjs/microservices/context/rpc-context-creator';

const logger = new Logger('DebugRpcContextCreatorV6');

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
    
    // Patch createPipesFn to log exactly what getParamValue returns
    const originalCreatePipesFn = self.createPipesFn;
    self.createPipesFn = function(pipes: any[], paramsOptions: any[]) {
        logger.debug(`[V6] createPipesFn for ${methodName}`);
        
        const result = originalCreatePipesFn.call(self, pipes, paramsOptions);
        
        if (!result) {
            return null;
        }
        
        // Wrap to log what happens in pipesFn
        const originalPipesFn = result;
        return async function(this: any, args: any[], ...params: any[]) {
            logger.debug(`[V6] pipesFn executing for ${methodName}`);
            
            // For each param option, log what extractValue returns vs what getParamValue returns
            for (const param of paramsOptions) {
                const { index, extractValue, type, data, metatype, pipes: paramPipes } = param;
                
                logger.debug(`[V6] param index=${index}, type=${type}, data=${data}, metatype=${metatype}`);
                
                // Call extractValue to get raw value
                const rawValue = extractValue(...params);
                logger.debug(`[V6] extractValue returned: type=${typeof rawValue}, isFunction=${typeof rawValue === 'function'}`);
                
                // Call the original pipesFn to see what it sets args[index] to
            }
            
            // Now call original pipesFn
            await originalPipesFn.call(this, args, ...params);
            
            // Log what args[index] was set to
            logger.debug(`[V6] After pipesFn, args[0]: type=${typeof args[0]}, isFunction=${typeof args[0] === 'function'}`);
            if (typeof args[0] === 'function') {
                logger.debug(`[V6] args[0] function: ${args[0].toString().substring(0, 100)}`);
            }
        };
    };
    
    return originalCreate.call(self, instance, callback, moduleKey, methodName, contextId, inquirerId, defaultCallMetadata);
} as any;

logger.log('[DebugRpcContextCreatorV6] RPC context creator v6 with param-level logging applied');
