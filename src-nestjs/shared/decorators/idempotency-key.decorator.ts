import { type ExecutionContext, createParamDecorator } from '@nestjs/common';

export const IdempotencyKey = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.headers['idempotency-key'] || null;
});
