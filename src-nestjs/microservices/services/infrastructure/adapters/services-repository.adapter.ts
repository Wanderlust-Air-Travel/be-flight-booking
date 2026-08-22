import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Deal } from 'src/api-gateway/data-access/entities/deal/deal.entity';
import { Promotion } from 'src/api-gateway/data-access/entities/deal/promotion.entity';
import type { Repository } from 'typeorm';
import type {
    DealSummary,
    IServicesPort,
    PromotionSummary,
} from '../../application/handlers/services.handlers';

/**
 * TypeORM-backed adapter for IServicesPort.
 *
 * Replaces ServicesMockAdapter with real database implementation
 * reading from the Deals and Promotions tables.
 */
@Injectable()
export class ServicesRepositoryAdapter implements IServicesPort {
    constructor(
        @InjectRepository(Deal) private readonly dealRepo: Repository<Deal>,
        @InjectRepository(Promotion) private readonly promotionRepo: Repository<Promotion>
    ) {}

    async findActiveDeals(): Promise<DealSummary[]> {
        const now = new Date();

        const deals = await this.dealRepo
            .createQueryBuilder('deal')
            .where('deal.is_active = :isActive', { isActive: true })
            .andWhere('deal.valid_from <= :now', { now })
            .andWhere('deal.valid_until >= :now', { now })
            .orderBy('deal.created_at', 'DESC')
            .getMany();

        return deals.map((deal) => ({
            dealId: deal.deal_id,
            title: deal.title,
            description: deal.description || '',
            validFrom: deal.valid_from,
            validUntil: deal.valid_until,
            discountPct: deal.discount_pct,
            destinations: this.parseDestinations(deal.destinations),
        }));
    }

    async findPromoByCode(code: string): Promise<PromotionSummary | null> {
        const promotion = await this.promotionRepo.findOne({
            where: {
                code: code.toUpperCase(),
                is_active: true,
            },
        });

        if (!promotion) {
            return null;
        }

        return {
            promotionId: promotion.promotion_id,
            code: promotion.code,
            description: promotion.description || '',
            validUntil: promotion.valid_until,
            minPurchaseAmount: Number(promotion.min_purchase_amount),
            currency: promotion.currency,
            discountPct: promotion.discount_pct,
        };
    }

    async applyPromotion(promoCode: string, amount: number): Promise<number> {
        const promo = await this.findPromoByCode(promoCode);

        if (!promo) {
            return amount;
        }

        if (amount < promo.minPurchaseAmount) {
            return amount;
        }

        if (promo.validUntil < new Date()) {
            return amount;
        }

        return Math.round(amount * (1 - promo.discountPct / 100));
    }

    private parseDestinations(destinationsJson: string | null): string[] {
        if (!destinationsJson) {
            return [];
        }

        try {
            const parsed = JSON.parse(destinationsJson);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
}
