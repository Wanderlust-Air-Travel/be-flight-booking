import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CabinClass } from 'src/api-gateway/data-access/entities/cabin/cabin-class.entity';
import { FlightInstance } from 'src/api-gateway/data-access/entities/flight/flight-instance.entity';
import { FareClass } from 'src/api-gateway/data-access/entities/fare/fare-class.entity';
import { FareDescriptionRule } from 'src/api-gateway/data-access/entities/fare/fare-description-rule.entity';
import { RouteFarePrice } from 'src/api-gateway/data-access/entities/fare/route-fare-price.entity';
import type { FareOptionDto } from 'src/api-gateway/modules/search/dto/fare-option.dto';
import type { Repository } from 'typeorm';
import { CabinType } from '../constants/enums';

/**
 * FareOptionService — Builds fare options for a flight instance + cabin type
 * purely from database entities (FareClass, CabinClass, FareDescriptionRule,
 * RouteFarePrice). No mock/hardcoded data.
 */
@Injectable()
export class FareOptionService {
    private readonly logger = new Logger(FareOptionService.name);

    constructor(
        @InjectRepository(FareClass)
        private readonly _fareClassRepo: Repository<FareClass>,
        @InjectRepository(CabinClass)
        private readonly _cabinClassRepo: Repository<CabinClass>,
        @InjectRepository(FareDescriptionRule)
        private readonly _fareDescriptionRuleRepo: Repository<FareDescriptionRule>,
        @InjectRepository(FlightInstance)
        private readonly _flightInstanceRepo: Repository<FlightInstance>,
        @InjectRepository(RouteFarePrice)
        private readonly _routeFarePriceRepo: Repository<RouteFarePrice>
    ) {}

    /**
     * Resolve cabin class code from cabin type string ('economy' / 'business' / 'first' / 'premium_economy').
     * Matches by CabinClass.name (case-insensitive). Returns null if no match.
     */
    async resolveCabinClassByType(cabinType: string): Promise<CabinClass | null> {
        if (!cabinType) return null;
        const normalized = cabinType.toLowerCase().replace(/-/g, ' ').trim();
        const candidates = await this._cabinClassRepo.find();
        const match = candidates.find((cc) => cc.name.toLowerCase() === normalized);
        return match ?? null;
    }

    /**
     * List all cabin classes — used by the public endpoint that lets the frontend
     * map between cabin type names and cabin class codes.
     */
    async listAllCabinClasses(): Promise<CabinClass[]> {
        return this._cabinClassRepo.find({
            order: { cabin_class_code: 'ASC' },
        });
    }

    /**
     * Fetch a single fare class (with its parent cabin class) by code.
     */
    async getFareClassWithCabin(code: string): Promise<FareClass | null> {
        return this._fareClassRepo.findOne({
            where: { fare_class_code: code },
            relations: { cabin_class: true },
        });
    }

    /**
     * Build fare options for a flight instance and cabin type from DB entities.
     */
    async getFareOptionsForInstance(
        flightInstanceId: string,
        cabinType: CabinType
    ): Promise<FareOptionDto[]> {
        const cabinClass = await this.resolveCabinClassByType(cabinType);
        if (!cabinClass) {
            this.logger.warn(`No cabin class matched cabinType=${cabinType}`);
            return [];
        }

        const flightInstance = await this._flightInstanceRepo.findOne({
            where: { flight_instance_id: flightInstanceId },
            relations: { flight_schedule: { route: true } },
        });

        const routeId = flightInstance?.flight_schedule?.route_id ?? null;

        const fareClasses = await this._fareClassRepo.find({
            where: { cabin_class: { cabin_class_code: cabinClass.cabin_class_code } },
            relations: { cabin_class: true },
            order: { fare_class_code: 'ASC' },
        });

        if (!fareClasses.length) {
            this.logger.warn(
                `No fare classes found for cabin_class_code=${cabinClass.cabin_class_code}`
            );
            return [];
        }

        const fareClassCodes = fareClasses.map((fc) => fc.fare_class_code);

        // Pull all rules once and filter in-memory (cheap; limited dataset)
        const allRules = await this._fareDescriptionRuleRepo.find({
            where: { cabin_type: cabinType, is_active: true },
            order: { display_order: 'ASC' },
        });

        const fareOptions: FareOptionDto[] = [];
        for (const fc of fareClasses) {
            const price = await this.resolveFarePrice(
                routeId,
                fc.fare_class_code,
                flightInstance?.flight_date
            );

            const desc = this.buildDescForFareClass(
                fc.fare_class_code,
                cabinType,
                allRules
            );

            fareOptions.push({
                fareClassCode: fc.fare_class_code,
                cabinClassCode: fc.cabin_class.cabin_class_code,
                cabinClassName: fc.cabin_class.name,
                name: fc.description ?? fc.fare_class_code,
                typeTicket: fc.description ?? fc.fare_class_code,
                price,
                availableSeats: 0,
                desc,
                description: fc.description,
                changeRule: fc.change_rule,
                refundRule: fc.refund_rule,
            } as FareOptionDto);
        }

        // Suppress unused variable warning until seat-map wiring is plumbed here.
        void fareClassCodes;

        return fareOptions;
    }

    /**
     * Resolve base fare price from RouteFarePrice for the route + fare class + flight date.
     * Returns 0 when no matching active price is found.
     */
    private async resolveFarePrice(
        routeId: string | null,
        fareClassCode: string,
        flightDate?: Date
    ): Promise<number> {
        if (!routeId) return 0;
        try {
            const queryDate = flightDate ? this.toDateOnlyString(flightDate) : undefined;
            const qb = this._routeFarePriceRepo
                .createQueryBuilder('rfp')
                .where('rfp.route_id = :routeId', { routeId })
                .andWhere('rfp.fare_class_code = :fareClassCode', { fareClassCode })
                .andWhere('rfp.is_active = :isActive', { isActive: true });
            if (queryDate) {
                qb.andWhere('rfp.effective_from <= :queryDate', { queryDate })
                    .andWhere('(rfp.effective_to IS NULL OR rfp.effective_to >= :queryDate)', {
                        queryDate,
                    });
            }
            qb.orderBy('rfp.priority', 'DESC')
                .addOrderBy('rfp.effective_from', 'DESC');
            const price = await qb.getOne();
            return price ? Number(price.base_price) : 0;
        } catch (error) {
            this.logger.error(
                `Error resolving fare price for route=${routeId} fareClass=${fareClassCode}:`,
                error
            );
            return 0;
        }
    }

    private toDateOnlyString(d: Date): string {
        return d.toISOString().split('T')[0];
    }

    /**
     * Build the description list (text + status) for a fare class using FareDescriptionRule patterns.
     * Pattern matching order:
     *   1. exact fare_class_code match (if pattern equals fareClassCode)
     *   2. contains pattern (pattern is a substring of fareClassCode)
     *   3. default rule (pattern === 'DEFAULT')
     */
    private buildDescForFareClass(
        fareClassCode: string,
        cabinType: CabinType,
        allRules: FareDescriptionRule[]
    ): Array<{ text: string; status: boolean }> {
        const matched: FareDescriptionRule[] = [];
        const seenTexts = new Set<string>();

        const exact = allRules.filter(
            (r) => r.fare_class_code_pattern === fareClassCode
        );
        for (const r of exact) {
            if (seenTexts.has(r.description_text)) continue;
            matched.push(r);
            seenTexts.add(r.description_text);
        }

        const contains = allRules.filter(
            (r) =>
                r.fare_class_code_pattern !== 'DEFAULT' &&
                r.fare_class_code_pattern !== fareClassCode &&
                fareClassCode.includes(r.fare_class_code_pattern)
        );
        for (const r of contains) {
            if (seenTexts.has(r.description_text)) continue;
            matched.push(r);
            seenTexts.add(r.description_text);
        }

        const defaults = allRules.filter((r) => r.fare_class_code_pattern === 'DEFAULT');
        for (const r of defaults) {
            if (seenTexts.has(r.description_text)) continue;
            matched.push(r);
            seenTexts.add(r.description_text);
        }

        return matched
            .sort((a, b) => a.display_order - b.display_order)
            .map((r) => ({ text: r.description_text, status: r.status }));
    }
}
