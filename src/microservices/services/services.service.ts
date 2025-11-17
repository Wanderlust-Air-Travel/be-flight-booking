import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Route } from 'src/shared/entities/route/route.entity';
import { FlightInstance } from 'src/shared/entities/flight/flight-instance.entity';
import { FlightSchedule } from 'src/shared/entities/flight/flight-schedule.entity';
import { FlightSeat } from 'src/shared/entities/flight/flight-seat.entity';
import { BookingSegment } from 'src/shared/entities/booking/booking-segment.entity';
import { GetDealsResponseDto, FlightDealDto } from './dto/get-deals-response.dto';

@Injectable()
export class ServicesService {
	constructor(
		@InjectRepository(Route) private readonly routeRepo: Repository<Route>,
		@InjectRepository(FlightInstance) private readonly instanceRepo: Repository<FlightInstance>,
		@InjectRepository(FlightSchedule) private readonly scheduleRepo: Repository<FlightSchedule>,
		@InjectRepository(FlightSeat) private readonly seatRepo: Repository<FlightSeat>,
		@InjectRepository(BookingSegment) private readonly bookingSegmentRepo: Repository<BookingSegment>,
	) {}

	async getDeals(): Promise<GetDealsResponseDto> {
		// Get all active domestic routes
		const routes = await this.routeRepo
			.createQueryBuilder('route')
			.innerJoinAndSelect('route.origin_airport', 'origin')
			.innerJoinAndSelect('route.destination_airport', 'destination')
			.where('route.is_domestic = :domestic', { domestic: true })
			.getMany();

		// Get deals for each route
		const deals = await Promise.all(
			routes.map(async (route) => {
				return this.getDealForRoute(route);
			}),
		);

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

	private async getDealForRoute(route: Route): Promise<FlightDealDto | null> {
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
			.andWhere('fi.flight_date <= :futureDate', { futureDate: futureDate.toISOString().slice(0, 10) })
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
				.where('seat.flight_instance_id = :instanceId', { instanceId: instance.flight_instance_id })
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

		// Lấy giá trung bình từ BookingSegments trong database
		// Bước 1: Thử lấy giá trung bình từ chính flight instance này
		let avgPrice = await this.getHistoricalPriceForRoute(route.route_id, selectedInstance.flight_instance_id);
		
		// Bước 2: Nếu không có, lấy giá trung bình từ bất kỳ flight instance nào của route này
		if (avgPrice === null || avgPrice === 0) {
			avgPrice = await this.getHistoricalPriceForRoute(route.route_id);
		}
		
		// Nếu không có giá từ database, bỏ qua route này
		if (avgPrice === null || avgPrice === 0) {
			const routeInfo = `${route.origin_airport.iata_code} -> ${route.destination_airport.iata_code}`;
			console.log(`[Services] Route ${routeInfo}: No booking data found, skipping route`);
			return null;
		}

		// Log để debug
		const routeInfo = `${route.origin_airport.iata_code} -> ${route.destination_airport.iata_code}`;
		console.log(`[Services] Route ${routeInfo}: Average price ${avgPrice} VND (from database)`);

		// Format route title - handle "Tp." prefix for Ho Chi Minh City
		const originCity = route.origin_airport.city;
		const originCode = route.origin_airport.iata_code;
		const destCity = route.destination_airport.city;
		const destCode = route.destination_airport.iata_code;
		
		// Format city name: if city is "Ho Chi Minh City" or similar, use "Tp. Hồ Chí Minh"
		const formatCityName = (city: string): string => {
			if (city.toLowerCase().includes('ho chi minh') || city.toLowerCase().includes('hồ chí minh')) {
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
		
		return {
			image,
			title,
			link,
			startDate,
			endDate: '', // One-way flights only for deals
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
		return parseInt(priceString.replace(/[^\d]/g, ''), 10);
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
	 * Lấy giá từ BookingSegments trong database
	 * @param routeId Route ID
	 * @param flightInstanceId Flight instance ID (optional, để lấy giá từ instance cụ thể)
	 * @returns Giá trung bình (base_fare + tax + fee) hoặc null nếu không có
	 */
	private async getHistoricalPriceForRoute(routeId: string, flightInstanceId?: string): Promise<number | null> {
		try {
			// Tìm các booking segments cho route này
			// Join qua FlightInstance -> FlightSchedule -> Route
			const query = this.bookingSegmentRepo
				.createQueryBuilder('bs')
				.innerJoin('bs.flight_instance', 'fi')
				.innerJoin('fi.flight_schedule', 'fs')
				.where('fs.route_id = :routeId', { routeId })
				.andWhere('bs.status IN (:...statuses)', { statuses: ['booked', 'confirmed', 'completed'] })
				.select([
					'bs.base_fare',
					'bs.tax_amount',
					'bs.fee_amount',
				])
				.limit(100); // Lấy nhiều booking để tính trung bình chính xác hơn

			// Nếu có flightInstanceId, ưu tiên lấy giá từ cùng instance
			if (flightInstanceId) {
				query.andWhere('fi.flight_instance_id = :instanceId', { instanceId: flightInstanceId });
			}

			const segments = await query.getMany();

			if (segments.length === 0) {
				console.log(`[Services] No booking segments found for route ${routeId}${flightInstanceId ? `, instance ${flightInstanceId}` : ''}`);
				return null;
			}

			console.log(`[Services] Found ${segments.length} booking segments for route ${routeId}${flightInstanceId ? `, instance ${flightInstanceId}` : ''}`);

			// Tính tổng giá (base_fare + tax + fee) cho mỗi segment
			const totalPrices = segments.map(seg => {
				const baseFare = typeof seg.base_fare === 'string' ? parseFloat(seg.base_fare) : Number(seg.base_fare);
				const tax = typeof seg.tax_amount === 'string' ? parseFloat(seg.tax_amount) : Number(seg.tax_amount);
				const fee = typeof seg.fee_amount === 'string' ? parseFloat(seg.fee_amount) : Number(seg.fee_amount);
				return baseFare + tax + fee;
			}).filter(price => !isNaN(price) && price > 0); // Lọc bỏ giá không hợp lệ

			if (totalPrices.length === 0) {
				return null;
			}

			// Tính giá trung bình
			const avgPrice = totalPrices.reduce((sum, price) => sum + price, 0) / totalPrices.length;
			
			// Log chi tiết để verify data thật
			console.log(`[Services] Route ${routeId}: Calculated average from ${totalPrices.length} bookings. Min: ${Math.min(...totalPrices).toLocaleString('vi-VN')}, Max: ${Math.max(...totalPrices).toLocaleString('vi-VN')}, Avg: ${Math.round(avgPrice).toLocaleString('vi-VN')} VND`);
			
			// Làm tròn về số nguyên
			return Math.round(avgPrice);
		} catch (error) {
			console.error(`[Services] Error getting historical price for route ${routeId}:`, error);
			return null; // Nếu có lỗi, trả về null
		}
	}
}