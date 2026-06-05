import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BookingSegment } from 'src/shared/entities/booking/booking-segment.entity';
import { RouteFarePrice } from 'src/shared/entities/fare/route-fare-price.entity';
import { FlightInstance } from 'src/shared/entities/flight/flight-instance.entity';
import { FlightSchedule } from 'src/shared/entities/flight/flight-schedule.entity';
import { FlightSeat } from 'src/shared/entities/flight/flight-seat.entity';
import { Route } from 'src/shared/entities/route/route.entity';
import type { Repository } from 'typeorm';
import type { FlightDealDto, GetDealsResponseDto } from './dto/get-deals-response.dto';

@Injectable()
export class ServicesService {
    constructor(
        @InjectRepository(Route) private readonly routeRepo: Repository<Route>,
        @InjectRepository(FlightInstance) private readonly instanceRepo: Repository<FlightInstance>,
        @InjectRepository(FlightSchedule) private readonly scheduleRepo: Repository<FlightSchedule>,
        @InjectRepository(FlightSeat) private readonly seatRepo: Repository<FlightSeat>,
        @InjectRepository(BookingSegment)
        private readonly bookingSegmentRepo: Repository<BookingSegment>,
        @InjectRepository(RouteFarePrice)
        private readonly routeFarePriceRepo: Repository<RouteFarePrice>
    ) {}

    async getDeals(): Promise<GetDealsResponseDto> {
        // Get all active domestic routes
        const routes = await this.routeRepo
            .createQueryBuilder('route')
            .innerJoinAndSelect('route.origin_airport', 'origin')
            .innerJoinAndSelect('route.destination_airport', 'destination')
            .where('route.is_domestic = :domestic', { domestic: true })
            .getMany();

        // Get deals for each route (both one-way and round-trip if available)
        const dealsPromises: Promise<FlightDealDto | null>[] = [];

        for (const route of routes) {
            // Always try to get one-way deal
            dealsPromises.push(this.getDealForRoute(route, 'one_way'));

            // Also try to get round-trip deal if return route exists
            dealsPromises.push(this.getDealForRoute(route, 'round_trip'));
        }

        const deals = await Promise.all(dealsPromises);

        // Filter out null deals (routes with no available flights)
        const validDeals = deals.filter((deal): deal is FlightDealDto => deal !== null);

        // Sort by price (ascending) and limit to top deals if needed
        validDeals.sort((a, b) => {
            const priceA = this.parsePrice(a.price);
            const priceB = this.parsePrice(b.price);
            return priceA - priceB;
        });

        return { deals: validDeals };
    }

    private async getDealForRoute(
        route: Route,
        tripType: 'one_way' | 'round_trip'
    ): Promise<FlightDealDto | null> {
        // Find the cheapest available flight instance for this route
        // Look for flights in the future (next 30 days)
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + 30);

        const instances = await this.instanceRepo
            .createQueryBuilder('fi')
            .innerJoin('fi.flight_schedule', 'fs')
            .where('fs.route_id = :routeId', { routeId: route.route_id })
            .andWhere('fi.flight_date >= :today', { today: today.toISOString().slice(0, 10) })
            .andWhere('fi.flight_date <= :futureDate', {
                futureDate: futureDate.toISOString().slice(0, 10),
            })
            .andWhere('fi.status IN (:...statuses)', { statuses: ['scheduled', 'on_time'] })
            .orderBy('fi.flight_date', 'ASC')
            .getMany();

        if (instances.length === 0) {
            return null;
        }

        // Get the first available instance with seats
        let selectedInstance: FlightInstance | null = null;
        for (const instance of instances) {
            const availableSeats = await this.seatRepo
                .createQueryBuilder('seat')
                .where('seat.flight_instance_id = :instanceId', {
                    instanceId: instance.flight_instance_id,
                })
                .andWhere('seat.is_available = :available', { available: true })
                .getCount();

            if (availableSeats > 0) {
                selectedInstance = instance;
                break;
            }
        }

        if (!selectedInstance) {
            return null;
        }

        // Lấy giá từ RouteFarePrice trước, sau đó mới fallback sang BookingSegments
        const avgPrice = await this.getPriceForRoute(
            route.route_id,
            selectedInstance.flight_instance_id
        );

        // Nếu không có giá từ RouteFarePrice hoặc BookingSegments, bỏ qua route này
        if (avgPrice === null || avgPrice === 0) {
            return null;
        }

        const routeInfo = `${route.origin_airport.iata_code} -> ${route.destination_airport.iata_code}`;

        // Format route title - handle "Tp." prefix for Ho Chi Minh City
        const originCity = route.origin_airport.city;
        const originCode = route.origin_airport.iata_code;
        const destCity = route.destination_airport.city;
        const destCode = route.destination_airport.iata_code;

        // Format city name: if city is "Ho Chi Minh City" or similar, use "Tp. Hồ Chí Minh"
        const formatCityName = (city: string): string => {
            if (
                city.toLowerCase().includes('ho chi minh') ||
                city.toLowerCase().includes('hồ chí minh')
            ) {
                return 'Tp. Hồ Chí Minh';
            }
            return city;
        };

        const title = `${formatCityName(originCity)} (${originCode}) đến ${formatCityName(destCity)} (${destCode})`;

        // Format date
        const flightDate = new Date(selectedInstance.flight_date);
        const startDate = this.formatDate(flightDate);

        // Format price
        const formattedPrice = this.formatPrice(avgPrice);

        // Lấy image_url và service_link từ database
        // Nếu không có trong DB, generate fallback (cho routes cũ chưa có data)
        const image = route.image_url || this.generateImageUrl(route.route_id);
        const link = route.service_link || `/service/${route.route_id}`;

        // Handle round-trip deals
        if (tripType === 'round_trip') {
            // Find return route (reverse route)
            const returnRoute = await this.routeRepo
                .createQueryBuilder('route')
                .innerJoinAndSelect('route.origin_airport', 'origin')
                .innerJoinAndSelect('route.destination_airport', 'destination')
                .where('route.origin_airport_id = :destId', {
                    destId: route.destination_airport_id,
                })
                .andWhere('route.destination_airport_id = :originId', {
                    originId: route.origin_airport_id,
                })
                .andWhere('route.is_domestic = :domestic', { domestic: true })
                .getOne();

            if (!returnRoute) {
                // No return route, skip round-trip deal
                return null;
            }

            // Find return flight instance (7 days after departure, or next available)
            const returnDate = new Date(selectedInstance.flight_date);
            returnDate.setDate(returnDate.getDate() + 7); // Default: 7 days later
            const maxReturnDate = new Date(returnDate);
            maxReturnDate.setDate(returnDate.getDate() + 30); // Search within 30 days

            const returnInstances = await this.instanceRepo
                .createQueryBuilder('fi')
                .innerJoin('fi.flight_schedule', 'fs')
                .where('fs.route_id = :routeId', { routeId: returnRoute.route_id })
                .andWhere('fi.flight_date >= :returnDate', {
                    returnDate: returnDate.toISOString().slice(0, 10),
                })
                .andWhere('fi.flight_date <= :maxReturnDate', {
                    maxReturnDate: maxReturnDate.toISOString().slice(0, 10),
                })
                .andWhere('fi.status IN (:...statuses)', { statuses: ['scheduled', 'on_time'] })
                .orderBy('fi.flight_date', 'ASC')
                .getMany();

            if (returnInstances.length === 0) {
                // No return flights available, skip round-trip deal
                return null;
            }

            // Get the first available return instance with seats
            let selectedReturnInstance: FlightInstance | null = null;
            for (const instance of returnInstances) {
                const availableSeats = await this.seatRepo
                    .createQueryBuilder('seat')
                    .where('seat.flight_instance_id = :instanceId', {
                        instanceId: instance.flight_instance_id,
                    })
                    .andWhere('seat.is_available = :available', { available: true })
                    .getCount();

                if (availableSeats > 0) {
                    selectedReturnInstance = instance;
                    break;
                }
            }

            if (!selectedReturnInstance) {
                // No available return seats, skip round-trip deal
                return null;
            }

            // Get return route price từ RouteFarePrice hoặc BookingSegments
            const returnAvgPrice = await this.getPriceForRoute(
                returnRoute.route_id,
                selectedReturnInstance.flight_instance_id
            );

            if (returnAvgPrice === null || returnAvgPrice === 0) {
                // No return price data, skip round-trip deal
                return null;
            }

            // Calculate total price for round-trip
            const totalPrice = avgPrice + returnAvgPrice;
            const formattedTotalPrice = this.formatPrice(totalPrice);
            const endDate = this.formatDate(new Date(selectedReturnInstance.flight_date));

            return {
                image,
                title,
                link,
                startDate,
                endDate,
                tripType: 'round_trip',
                service: 'Dịch vụ bay khứ hồi', // Round-trip service
                price: formattedTotalPrice,
            };
        }

        // One-way deal
        return {
            image,
            title,
            link,
            startDate,
            endDate: '',
            tripType: 'one_way',
            service: 'Dịch vụ bay thẳng', // Direct flight service
            price: formattedPrice,
        };
    }

    private formatDate(date: Date): string {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    private formatPrice(price: number): string {
        return `${price.toLocaleString('vi-VN')} VND`;
    }

    private parsePrice(priceString: string): number {
        // Remove "VND" and commas, then parse
        return Number.parseInt(priceString.replace(/[^\d]/g, ''), 10);
    }

    /**
     * Generate image URL fallback nếu route chưa có image_url trong database
     * Format chuẩn: '/images/routes/{route_id}.jpg'
     * route_id là UUID v7 (36 ký tự)
     */
    private generateImageUrl(routeId: string): string {
        return `/images/routes/${routeId}.jpg`;
    }

    /**
     * Get price for a route: try RouteFarePrice first, then BookingSegments
     * @param routeId Route ID
     * @param flightInstanceId Optional flight instance ID
     * @returns Price or null if not found
     */
    private async getPriceForRoute(
        routeId: string,
        flightInstanceId?: string
    ): Promise<number | null> {
        // Bước 1: Thử lấy giá từ RouteFarePrice (được seed từ internal schedule)
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];

        const routeFarePrice = await this.routeFarePriceRepo
            .createQueryBuilder('rfp')
            .where('rfp.route_id = :routeId', { routeId })
            .andWhere('rfp.is_active = :isActive', { isActive: true })
            .andWhere('rfp.effective_from <= :dateStr', { dateStr })
            .andWhere('(rfp.effective_to IS NULL OR rfp.effective_to >= :dateStr)', { dateStr })
            .orderBy('rfp.priority', 'DESC')
            .addOrderBy('rfp.effective_from', 'DESC')
            .getOne();

        if (routeFarePrice) {
            const basePrice = Number(routeFarePrice.base_price);
            const taxRate = Number(routeFarePrice.tax_rate);
            const feeRate = Number(routeFarePrice.fee_rate);
            return Math.round(basePrice * (1 + taxRate + feeRate));
        }

        // Bước 2: Fallback sang BookingSegments (lịch sử booking)
        const query = this.bookingSegmentRepo
            .createQueryBuilder('bs')
            .innerJoin('bs.flight_instance', 'fi')
            .innerJoin('fi.flight_schedule', 'fs')
            .where('fs.route_id = :routeId', { routeId })
            .andWhere('bs.status IN (:...statuses)', {
                statuses: ['booked', 'confirmed', 'completed'],
            })
            .select(['bs.base_fare', 'bs.tax_amount', 'bs.fee_amount'])
            .limit(100);

        if (flightInstanceId) {
            query.andWhere('fi.flight_instance_id = :instanceId', { instanceId: flightInstanceId });
        }

        const segments = await query.getMany();

        if (segments.length === 0) {
            return null;
        }

        const totalPrices = segments
            .map((seg) => {
                const baseFare =
                    typeof seg.base_fare === 'string'
                        ? Number.parseFloat(seg.base_fare)
                        : Number(seg.base_fare);
                const tax =
                    typeof seg.tax_amount === 'string'
                        ? Number.parseFloat(seg.tax_amount)
                        : Number(seg.tax_amount);
                const fee =
                    typeof seg.fee_amount === 'string'
                        ? Number.parseFloat(seg.fee_amount)
                        : Number(seg.fee_amount);
                return baseFare + tax + fee;
            })
            .filter((price) => !Number.isNaN(price) && price > 0);

        if (totalPrices.length === 0) {
            return null;
        }

        return Math.round(totalPrices.reduce((sum, price) => sum + price, 0) / totalPrices.length);
    }
}
