import { Inject, Injectable } from '@nestjs/common';

export interface DealSummary {
    dealId: string;
    title: string;
    description: string;
    validFrom: Date;
    validUntil: Date;
    discountPct: number;
    destinations: string[];
}

export interface PromotionSummary {
    promotionId: string;
    code: string;
    description: string;
    validUntil: Date;
    minPurchaseAmount: number;
    currency: string;
}

/**
 * IServicesPort — Read port for promotions and deals.
 */
export interface IServicesPort {
    findActiveDeals(): Promise<DealSummary[]>;
    findPromoByCode(code: string): Promise<PromotionSummary | null>;
    applyPromotion(promoCode: string, amount: number): Promise<number>;
}

@Injectable()
export class GetDealsHandler {
    constructor(@Inject('IServicesPort') private readonly port: IServicesPort) {}

    async execute(): Promise<DealSummary[]> {
        return this.port.findActiveDeals();
    }
}

@Injectable()
export class ApplyPromotionHandler {
    constructor(@Inject('IServicesPort') private readonly port: IServicesPort) {}

    async execute(input: { promoCode: string; amount: number }): Promise<{
        applied: boolean;
        finalAmount: number;
        discount: number;
    }> {
        const final = await this.port.applyPromotion(input.promoCode, input.amount);
        return {
            applied: final !== input.amount,
            finalAmount: final,
            discount: input.amount - final,
        };
    }
}