import { Logger } from '@nestjs/common';
import { RpcParamsFactory } from '@nestjs/microservices/factories/rpc-params-factory';
import { RpcParamtype } from '@nestjs/microservices/enums/rpc-paramtype.enum';

const originalExchangeKeyForValue = RpcParamsFactory.prototype.exchangeKeyForValue;
const logger = new Logger('DebugRpcParamsFactory');

RpcParamsFactory.prototype.exchangeKeyForValue = function(type: number, data: any, args: any[]) {
    logger.debug(`[DEBUG] exchangeKeyForValue called:`);
    logger.debug(`  type: ${type} (PAYLOAD=${RpcParamtype.PAYLOAD}, CONTEXT=${RpcParamtype.CONTEXT}, GRPC_CALL=${RpcParamtype.GRPC_CALL})`);
    logger.debug(`  data: ${JSON.stringify(data)}`);
    logger.debug(`  args length: ${args?.length}`);
    if (args?.length > 0) {
        logger.debug(`  args[0] type: ${typeof args[0]}, isFunction: ${typeof args[0] === 'function'}`);
        if (typeof args[0] !== 'function') {
            logger.debug(`  args[0]: ${JSON.stringify(args[0])}`);
        }
    }
    
    const result = originalExchangeKeyForValue.call(this, type, data, args);
    
    logger.debug(`  result type: ${typeof result}, isFunction: ${typeof result === 'function'}`);
    if (typeof result !== 'function') {
        logger.debug(`  result: ${JSON.stringify(result)}`);
    }
    
    return result;
};

export {};
