import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { SERVICES_MS } from '../../services.messages';
import type {
    ApplyPromotionHandler,
    GetDealsHandler,
} from '../application/handlers/services.handlers';

@Controller()
export class ServicesMessageHandler {
    constructor(
        private readonly getDeals: GetDealsHandler,
        private readonly applyPromo: ApplyPromotionHandler
    ) {}

    @MessagePattern(SERVICES_MS.PATTERN.GET_DEALS)
    async deals(): Promise<any> {
        return this.getDeals.execute();
    }

    @MessagePattern(SERVICES_MS.PATTERN.APPLY_PROMOTION)
    async apply(payload: any): Promise<any> {
        return this.applyPromo.execute({
            promoCode: payload.code,
            amount: payload.amount,
        });
    }
}
