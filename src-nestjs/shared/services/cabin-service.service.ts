import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { CabinService } from '../entities/cabin/cabin-service.entity';
import { BaggageAllowance } from '../entities/fare/baggage-allowance.entity';

/**
 * Cabin Service Service
 * Retrieves baggage allowances and cabin services from database
 */
@Injectable()
export class CabinServiceService {
    private readonly logger = new Logger(CabinServiceService.name);

    constructor(
        @InjectRepository(BaggageAllowance)
        private readonly _baggageAllowanceRepo: Repository<BaggageAllowance>,
        @InjectRepository(CabinService)
        private readonly _cabinServiceRepo: Repository<CabinService>
    ) {}

    private get baggageAllowanceRepo(): Repository<BaggageAllowance> {
        return this._baggageAllowanceRepo;
    }

    private get cabinServiceRepo(): Repository<CabinService> {
        return this._cabinServiceRepo;
    }

    /**
     * Get baggage allowance for a fare class
     * @param fareClassCode Fare class code
     * @param isDomestic Whether the route is domestic
     * @returns BaggageAllowance or null if not found
     */
    async getBaggageAllowance(
        fareClassCode: string,
        isDomestic: boolean
    ): Promise<BaggageAllowance | null> {
        try {
            const allowance = await this.baggageAllowanceRepo.findOne({
                where: {
                    fare_class_code: fareClassCode,
                    is_domestic: isDomestic ? true : undefined,
                    is_international: isDomestic ? undefined : true,
                },
            });

            return allowance || null;
        } catch (error) {
            this.logger.error(
                `Error getting baggage allowance for fare class ${fareClassCode}:`,
                error
            );
            return null;
        }
    }

    /**
     * Get all cabin services for a cabin class
     * @param cabinClassCode Cabin class code
     * @returns Array of CabinService
     */
    async getCabinServicesByCabinClass(cabinClassCode: string): Promise<CabinService[]> {
        try {
            return await this.cabinServiceRepo.find({
                where: {
                    cabin_class_code: cabinClassCode,
                    is_active: true,
                },
                order: {
                    display_order: 'ASC',
                },
            });
        } catch (error) {
            this.logger.error(
                `Error getting cabin services for cabin class ${cabinClassCode}:`,
                error
            );
            return [];
        }
    }

    /**
     * Get all cabin services for a fare class
     * @param fareClassCode Fare class code
     * @returns Array of CabinService
     */
    async getCabinServicesByFareClass(fareClassCode: string): Promise<CabinService[]> {
        try {
            return await this.cabinServiceRepo.find({
                where: {
                    fare_class_code: fareClassCode,
                    is_active: true,
                },
                order: {
                    display_order: 'ASC',
                },
            });
        } catch (error) {
            this.logger.error(
                `Error getting cabin services for fare class ${fareClassCode}:`,
                error
            );
            return [];
        }
    }

    /**
     * Get all cabin services for a fare class (includes both fare-class specific and cabin-class specific)
     * @param fareClassCode Fare class code
     * @param cabinClassCode Cabin class code
     * @returns Array of CabinService
     */
    async getCabinServices(fareClassCode: string, cabinClassCode: string): Promise<CabinService[]> {
        try {
            // Get fare-class specific services
            const fareClassServices = await this.cabinServiceRepo.find({
                where: {
                    fare_class_code: fareClassCode,
                    is_active: true,
                },
                order: {
                    display_order: 'ASC',
                },
            });

            // Get cabin-class specific services (that are not fare-class specific)
            const cabinClassServices = await this.cabinServiceRepo
                .createQueryBuilder('cs')
                .where('cs.cabin_class_code = :cabinClassCode', { cabinClassCode })
                .andWhere('cs.fare_class_code IS NULL')
                .andWhere('cs.is_active = :isActive', { isActive: true })
                .orderBy('cs.display_order', 'ASC')
                .getMany();

            // Combine and deduplicate by service_type
            const serviceMap = new Map<string, CabinService>();

            // Add cabin class services first (lower priority)
            cabinClassServices.forEach((service) => {
                if (!serviceMap.has(service.service_type)) {
                    serviceMap.set(service.service_type, service);
                }
            });

            // Add fare class services (higher priority, overrides cabin class)
            fareClassServices.forEach((service) => {
                serviceMap.set(service.service_type, service);
            });

            return Array.from(serviceMap.values()).sort(
                (a, b) => a.display_order - b.display_order
            );
        } catch (error) {
            this.logger.error(
                `Error getting cabin services for fare class ${fareClassCode}, cabin class ${cabinClassCode}:`,
                error
            );
            return [];
        }
    }
}
