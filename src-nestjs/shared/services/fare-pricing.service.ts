import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { CabinType } from '../constants/enums';
import { RouteFarePrice } from '../entities/fare/route-fare-price.entity';

/**
 * Fare Pricing Service
 * Retrieves fare prices from database instead of hardcoded values
 * Supports dynamic pricing, seasonal pricing, and route-specific pricing
 */
@Injectable()
export class FarePricingService {
    private readonly logger = new Logger(FarePricingService.name);

    constructor(
        @InjectRepository(RouteFarePrice)
        private readonly _routeFarePriceRepo: Repository<RouteFarePrice>
    ) {}

    /**
     * Get fare price for a specific route and fare class
     * @param routeId Route ID
     * @param fareClassCode Fare class code
     * @param flightDate Optional flight date to check effective dates (defaults to today)
     * @returns RouteFarePrice or null if not found
     */
    async getFarePrice(
        routeId: string,
        fareClassCode: string,
        flightDate?: Date
    ): Promise<RouteFarePrice | null> {
        try {
            const queryDate = flightDate || new Date();
            const dateString = queryDate.toISOString().split('T')[0]; // YYYY-MM-DD format

            const price = await this.routeFarePriceRepo
                .createQueryBuilder('rfp')
                .where('rfp.route_id = :routeId', { routeId })
                .andWhere('rfp.fare_class_code = :fareClassCode', { fareClassCode })
                .andWhere('rfp.is_active = :isActive', { isActive: true })
                .andWhere('rfp.effective_from <= :queryDate', { queryDate: dateString })
                .andWhere('(rfp.effective_to IS NULL OR rfp.effective_to >= :queryDate)', {
                    queryDate: dateString,
                })
                .orderBy('rfp.priority', 'DESC') // Higher priority first
                .addOrderBy('rfp.effective_from', 'DESC') // Most recent first
                .getOne();

            return price || null;
        } catch (error) {
            this.logger.error(
                `Error getting fare price for route ${routeId}, fare class ${fareClassCode}:`,
                error
            );
            return null;
        }
    }

    /**
     * Calculate base fare price from database
     * Falls back to default pricing if not found in database
     * @param routeId Route ID
     * @param fareClassCode Fare class code
     * @param cabinType Cabin type (for fallback calculation)
     * @param flightDate Optional flight date
     * @returns Base fare price in VND
     */
    async calculateBaseFare(
        routeId: string,
        fareClassCode: string,
        cabinType: CabinType,
        flightDate?: Date
    ): Promise<number> {
        const routeFarePrice = await this.getFarePrice(routeId, fareClassCode, flightDate);

        if (routeFarePrice) {
            return Number(routeFarePrice.base_price);
        }

        // Fallback to default pricing (for backward compatibility)
        this.logger.warn(
            `No fare price found in database for route ${routeId}, fare class ${fareClassCode}. Using fallback pricing.`
        );
        return this.getFallbackPrice(fareClassCode, cabinType);
    }

    /**
     * Get tax rate for a route and fare class
     * @param routeId Route ID
     * @param fareClassCode Fare class code
     * @param flightDate Optional flight date
     * @returns Tax rate (as decimal, e.g., 0.1 for 10%)
     */
    async getTaxRate(routeId: string, fareClassCode: string, flightDate?: Date): Promise<number> {
        const routeFarePrice = await this.getFarePrice(routeId, fareClassCode, flightDate);
        return routeFarePrice ? Number(routeFarePrice.tax_rate) : 0.1; // Default 10%
    }

    /**
     * Get fee rate for a route and fare class
     * @param routeId Route ID
     * @param fareClassCode Fare class code
     * @param flightDate Optional flight date
     * @returns Fee rate (as decimal, e.g., 0.05 for 5%)
     */
    async getFeeRate(routeId: string, fareClassCode: string, flightDate?: Date): Promise<number> {
        const routeFarePrice = await this.getFarePrice(routeId, fareClassCode, flightDate);
        return routeFarePrice ? Number(routeFarePrice.fee_rate) : 0.05; // Default 5%
    }

    /**
     * Get complete pricing information (base price, tax rate, fee rate)
     * @param routeId Route ID
     * @param fareClassCode Fare class code
     * @param cabinType Cabin type (for fallback)
     * @param flightDate Optional flight date
     * @returns Pricing information
     */
    async getPricingInfo(
        routeId: string,
        fareClassCode: string,
        cabinType: CabinType,
        flightDate?: Date
    ): Promise<{
        basePrice: number;
        taxRate: number;
        feeRate: number;
        source: 'database' | 'fallback';
    }> {
        const routeFarePrice = await this.getFarePrice(routeId, fareClassCode, flightDate);

        if (routeFarePrice) {
            return {
                basePrice: Number(routeFarePrice.base_price),
                taxRate: Number(routeFarePrice.tax_rate),
                feeRate: Number(routeFarePrice.fee_rate),
                source: 'database',
            };
        }

        // Fallback pricing
        return {
            basePrice: this.getFallbackPrice(fareClassCode, cabinType),
            taxRate: 0.1,
            feeRate: 0.05,
            source: 'fallback',
        };
    }

    /**
     * Fallback pricing (for backward compatibility)
     * Used when no price is found in database
     * @param fareClassCode Fare class code
     * @param cabinType Cabin type
     * @returns Base fare price
     */
    private getFallbackPrice(fareClassCode: string, cabinType: CabinType): number {
        const code = fareClassCode.toUpperCase();

        if (cabinType === CabinType.ECONOMY) {
            if (code.includes('SMX') || code.includes('SAVER')) {
                return 1448000; // Economy Saver Max
            }
            if (code === 'Y') {
                return 1577000; // Economy Standard
            }
            if (code.includes('SM') || code === 'YS') {
                return 1577000; // Economy Smart
            }
            if (code.includes('FLX') || code.includes('FLEX') || code === 'YF') {
                return 3068000; // Economy Flex
            }
            return 1577000; // Default economy price
        }
        if (cabinType === CabinType.BUSINESS) {
            if (code === 'J') {
                return 5022000; // Business Standard
            }
            if (code.includes('SM') || code === 'JS') {
                return 5022000; // Business Smart
            }
            if (code.includes('FLX') || code.includes('FLEX') || code === 'JF') {
                return 7074000; // Business Flex
            }
            return 5022000; // Default business price
        }

        return 0;
    }
}
