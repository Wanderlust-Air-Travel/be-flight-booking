import { Logger } from '@nestjs/common';
import { ContextUtils } from '@nestjs/core/helpers/context-utils';

const logger = new Logger('DebugContextUtils');

const originalCreateNullArray = ContextUtils.prototype.createNullArray;

ContextUtils.prototype.createNullArray = function(length: number) {
    logger.debug(`[DEBUG] ContextUtils.createNullArray called with length: ${length}`);
    const result = originalCreateNullArray.call(this, length);
    logger.debug(`[DEBUG] ContextUtils.createNullArray result: [${result.map(v => v === undefined ? 'undefined' : JSON.stringify(v)).join(', ')}]`);
    return result;
};

logger.log('[DebugContextUtils] ContextUtils.createNullArray debug logging applied');
