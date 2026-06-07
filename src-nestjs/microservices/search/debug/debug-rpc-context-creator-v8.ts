import { Logger } from '@nestjs/common';
import { PARAMTYPES_METADATA } from '@nestjs/common/constants';
import { RpcContextCreator } from '@nestjs/microservices/context/rpc-context-creator';

const logger = new Logger('DebugRpcContextCreatorV8');

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
    
    // Patch reflectCallbackParamtypes to use methodName instead of callback.name
    const originalReflectCallbackParamtypes = self.reflectCallbackParamtypes;
    self.reflectCallbackParamtypes = function(instance: any, callback: Function) {
        const resultFromCallbackName = originalReflectCallbackParamtypes.call(self, instance, callback);
        logger.debug(`[V8] reflectCallbackParamtypes with callback.name="${callback.name}": ${JSON.stringify(resultFromCallbackName)}`);
        
        // Try with methodName instead
        const resultFromMethodName = Reflect.getMetadata(PARAMTYPES_METADATA, instance, methodName);
        logger.debug(`[V8] reflectCallbackParamtypes with methodName="${methodName}": ${JSON.stringify(resultFromMethodName)}`);
        
        return resultFromMethodName || resultFromCallbackName;
    };
    
    // Also patch the handlerMetadataStorage.get to log what's being looked up
    const handlerMetadataStorage = self.handlerMetadataStorage;
    if (handlerMetadataStorage) {
        const originalGet = handlerMetadataStorage.get.bind(handlerMetadataStorage);
        handlerMetadataStorage.get = function(instance: any, methodNameKey: string) {
            const result = originalGet(instance, methodNameKey);
            logger.debug(`[V8] handlerMetadataStorage.get(instance, "${methodNameKey}"): ${result ? 'HIT' : 'MISS'}`);
            return result;
        };
        
        const originalSet = handlerMetadataStorage.set.bind(handlerMetadataStorage);
        handlerMetadataStorage.set = function(instance: any, methodNameKey: string, metadata: any) {
            logger.debug(`[V8] handlerMetadataStorage.set(instance, "${methodNameKey}", ...)`);
            return originalSet(instance, methodNameKey, metadata);
        };
    }
    
    return originalCreate.call(self, instance, callback, moduleKey, methodName, contextId, inquirerId, defaultCallMetadata);
} as any;

logger.log('[DebugRpcContextCreatorV8] RPC context creator v8 with metatype fix applied');
