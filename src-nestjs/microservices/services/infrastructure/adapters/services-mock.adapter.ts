import { Injectable } from '@nestjs/common';
import type {
    DealSummary,
    IServicesPort,
    PromotionSummary,
} from '../../application/handlers/services.handlers';

/**
 * In-memory mock adapter for IServicesPort.
 *
 * TODO: replace with a real TypeORM-backed implementation that reads from
 * the `services` schema (deals, promotions tables). This stub exists so
 * the Services microservice can boot and respond to TCP requests while
 * the persistence layer is still being designed.
 */
@Injectable()
export class ServicesMockAdapter implements IServicesPort {
    private readonly deals: DealSummary[] = [
        {
            dealId: 'deal-hn-dn-01',
            title: 'Hà Nội ↔ Đà Nẵng — Giảm 20%',
            description: 'Khuyến mãi đặc biệt cho chuyến bay một chiều Hà Nội – Đà Nẵng.',
            validFrom: new Date('2026-08-01T00:00:00Z'),
            validUntil: new Date('2026-12-31T23:59:59Z'),
            discountPct: 20,
            destinations: ['HAN', 'DAD'],
        },
        {
            dealId: 'deal-sgn-cxr-01',
            title: 'TP.HCM ↔ Cam Ranh — Giảm 15%',
            description: 'Ưu đãi hè cho đường bay TP.HCM – Cam Ranh.',
            validFrom: new Date('2026-08-01T00:00:00Z'),
            validUntil: new Date('2026-10-31T23:59:59Z'),
            discountPct: 15,
            destinations: ['SGN', 'CXR'],
        },
    ];

    private readonly promotions: PromotionSummary[] = [
        {
            promotionId: 'promo-welcome',
            code: 'WELCOME10',
            description: 'Giảm 10% cho lần đặt vé đầu tiên.',
            validUntil: new Date('2026-12-31T23:59:59Z'),
            minPurchaseAmount: 1_000_000,
            currency: 'VND',
            discountPct: 10,
        },
        {
            promotionId: 'promo-summer',
            code: 'SUMMER15',
            description: 'Giảm 15% trong mùa hè 2026.',
            validUntil: new Date('2026-09-30T23:59:59Z'),
            minPurchaseAmount: 2_000_000,
            currency: 'VND',
            discountPct: 15,
        },
    ];

    async findActiveDeals(): Promise<DealSummary[]> {
        const now = new Date();
        return this.deals.filter(
            (d) => d.validFrom <= now && d.validUntil >= now,
        );
    }

    async findPromoByCode(code: string): Promise<PromotionSummary | null> {
        return this.promotions.find((p) => p.code === code) ?? null;
    }

    async applyPromotion(promoCode: string, amount: number): Promise<number> {
        const promo = await this.findPromoByCode(promoCode);
        if (!promo) {
            return amount;
        }
        if (amount < promo.minPurchaseAmount) {
            return amount;
        }
        return Math.round(amount * (1 - promo.discountPct / 100));
    }
}
