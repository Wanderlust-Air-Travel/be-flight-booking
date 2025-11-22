import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Airport } from 'src/shared/entities/airport/airport.entity';
import { Route } from 'src/shared/entities/route/route.entity';
import { FlightInstance } from 'src/shared/entities/flight/flight-instance.entity';
import { FlightSeat } from 'src/shared/entities/flight/flight-seat.entity';
import { FlightSchedule } from 'src/shared/entities/flight/flight-schedule.entity';
import { FareClass } from 'src/shared/entities/fare/fare-class.entity';
import { CabinClass } from 'src/shared/entities/cabin/cabin-class.entity';
import { SeatConfiguration } from 'src/shared/entities/seat/seat-configuration.entity';
import { SearchFlightsDto } from './dto/search-flights.dto';
import { FlightResult } from './interfaces/flight-result.interface';
import { GetFareOptionsDto } from './dto/get-fare-options.dto';
import { GetSeatMapDto } from './dto/get-seat-map.dto';
import { TripType, CabinType } from 'src/shared/constants/enums';
import { FareOptionsResponseDto, FareOptionsGroupDto } from './dto/fare-options-response.dto';
import { FareOptionDto, FareDescriptionItemDto } from './dto/fare-option.dto';
import { SeatMapResponseDto, SeatMapGroupDto } from './dto/seat-map-response.dto';
import { SeatDto } from './dto/seat.dto';

@Injectable()
export class SearchService {
	// Mapping cabin type to cabin class codes
	private readonly CABIN_TYPE_MAP: Record<CabinType, string[]> = {
		[CabinType.ECONOMY]: ['Y'], // Economy cabin class codes
		[CabinType.BUSINESS]: ['J'], // Business cabin class codes
		[CabinType.FIRST]: ['F'], // First class cabin class codes
	};

	// Mapping fare class codes to display names (based on description or code)
	private readonly FARE_CLASS_NAMES: Record<string, string> = {
		// Economy fare classes
		'YSM': 'Economy Saver Max',
		'YSMX': 'Economy Saver Max',
		'Y': 'Economy Standard',
		'YS': 'Economy Smart',
		'YF': 'Economy Flex',
		'YFLX': 'Economy Flex',
		// Business fare classes
		'J': 'Business Smart',
		'JS': 'Business Smart',
		'JF': 'Business Flex',
		'JFLX': 'Business Flex',
	};

	constructor(
		@InjectRepository(Airport) private readonly airportRepo: Repository<Airport>,
		@InjectRepository(Route) private readonly routeRepo: Repository<Route>,
		@InjectRepository(FlightInstance) private readonly instanceRepo: Repository<FlightInstance>,
		@InjectRepository(FlightSeat) private readonly seatRepo: Repository<FlightSeat>,
		@InjectRepository(FlightSchedule) private readonly scheduleRepo: Repository<FlightSchedule>,
		@InjectRepository(FareClass) private readonly fareClassRepo: Repository<FareClass>,
		@InjectRepository(CabinClass) private readonly cabinClassRepo: Repository<CabinClass>,
		@InjectRepository(SeatConfiguration) private readonly seatConfigRepo: Repository<SeatConfiguration>,
	) {}

	async search(dto: SearchFlightsDto) {
		const totalPax = dto.adults + dto.minors;
		console.log(`[DEBUG] Search request: ${dto.origin} -> ${dto.destination}, date: ${dto.departDate}, passengers: ${totalPax}`);
		
		const [origin, destination] = await Promise.all([
			this.airportRepo.findOne({ where: { iata_code: dto.origin.toUpperCase() } }),
			this.airportRepo.findOne({ where: { iata_code: dto.destination.toUpperCase() } }),
		]);
		if (!origin) throw new NotFoundException('Origin airport not found');
		if (!destination) throw new NotFoundException('Destination airport not found');
		
		console.log(`[DEBUG] Found airports: ${origin.iata_code} (${origin.airport_id}) -> ${destination.iata_code} (${destination.airport_id})`);

		// Query route bằng QueryBuilder vì origin_airport_id, destination_airport_id là @RelationId properties
		const route = await this.routeRepo
			.createQueryBuilder('route')
			.where('route.origin_airport_id = :originId', { originId: origin.airport_id })
			.andWhere('route.destination_airport_id = :destId', { destId: destination.airport_id })
			.andWhere('route.is_domestic = :domestic', { domestic: true })
			.getOne();
		if (!route) {
			console.log(`[DEBUG] No route found for ${origin.iata_code} -> ${destination.iata_code}`);
			throw new NotFoundException('No domestic route for selected airports');
		}
		
		console.log(`[DEBUG] Found route: ${route.route_id}`);

		const outboundDate = new Date(dto.departDate);
		const outbound = await this.findFlightsForDate(route.route_id, outboundDate, totalPax, origin, destination);

		if (dto.tripType === TripType.ONE_WAY) {
			return { tripType: dto.tripType, outbound, totalPassengers: totalPax };
		}

		// Validation should be handled by DTO, but double-check for safety
		if (!dto.returnDate) {
			throw new BadRequestException('returnDate is required when tripType is round_trip');
		}
		const returnDate = new Date(dto.returnDate);
		// Query inbound route bằng QueryBuilder vì origin_airport_id, destination_airport_id là @RelationId properties
		const inboundRoute = await this.routeRepo
			.createQueryBuilder('route')
			.where('route.origin_airport_id = :originId', { originId: destination.airport_id })
			.andWhere('route.destination_airport_id = :destId', { destId: origin.airport_id })
			.andWhere('route.is_domestic = :domestic', { domestic: true })
			.getOne();
		if (!inboundRoute) throw new NotFoundException('No domestic route for return segment');
		const inbound = await this.findFlightsForDate(inboundRoute.route_id, returnDate, totalPax, destination, origin);

		return { tripType: dto.tripType, outbound, inbound, totalPassengers: totalPax };
	}

	private async findFlightsForDate(routeId: string, date: Date, minSeats: number, origin: Airport, destination: Airport): Promise<FlightResult[]> {
		// Query flight instances for the exact date
		// Format date as YYYY-MM-DD for SQL Server comparison
		const dateStr = date.toISOString().slice(0, 10);
		
		console.log(`[DEBUG] Finding flights for route ${routeId}, date: ${dateStr}, minSeats: ${minSeats}`);
		
		const instances = await this.instanceRepo.createQueryBuilder('fi')
			.innerJoin('fi.flight_schedule', 'fs')
			.where('fs.route_id = :routeId', { routeId })
			.andWhere('CAST(fi.flight_date AS DATE) = CAST(:date AS DATE)', { date: dateStr })
			.andWhere('fi.status IN (:...st)', { st: ['scheduled', 'on_time', 'delayed'] })
			.orderBy('fi.departure_datetime_local', 'ASC')
			.getMany();

		console.log(`[DEBUG] Found ${instances.length} flight instances for date ${dateStr}`);

		// Calculate available seats for each instance
		const withAvailability = await Promise.all(instances.map(async (fi) => {
			// Use QueryBuilder with raw column name because flight_instance_id is a @RelationId property
			// TypeORM doesn't support @RelationId properties in count() where clauses
			// The actual column name in DB is 'flight_instance_id' (from @JoinColumn in entity)
			const availableSeats = await this.seatRepo
				.createQueryBuilder('seat')
				.where('seat.flight_instance_id = :instanceId', { instanceId: fi.flight_instance_id })
				.andWhere('seat.is_available = :available', { available: true })
				.getCount();
			console.log(`[DEBUG] Flight ${fi.flight_number} (${fi.flight_instance_id}): ${availableSeats} available seats`);
			return { fi, availableSeats };
		}));

		// Map to FlightResult, only include flights with valid flightInstanceId and enough seats
		const results: FlightResult[] = withAvailability
			.filter(x => {
				const hasEnoughSeats = x.availableSeats >= minSeats;
				const hasValidId = !!x.fi.flight_instance_id;
				if (!hasEnoughSeats) {
					console.log(`[DEBUG] Filtered out ${x.fi.flight_number}: only ${x.availableSeats} seats (need ${minSeats})`);
				}
				if (!hasValidId) {
					console.log(`[DEBUG] Filtered out ${x.fi.flight_number}: no flight_instance_id`);
				}
				return hasEnoughSeats && hasValidId;
			})
			.map(x => ({
				flightInstanceId: x.fi.flight_instance_id,
				flightNumber: x.fi.flight_number,
				departureLocal: x.fi.departure_datetime_local,
				arrivalLocal: x.fi.arrival_datetime_local,
				availableSeats: x.availableSeats,
				origin: { iata: origin.iata_code, name: origin.name, city: origin.city },
				destination: { iata: destination.iata_code, name: destination.name, city: destination.city },
			}));

		console.log(`[DEBUG] Returning ${results.length} flights with enough seats`);
		// Note: Removed fallback to schedules because fare-options API requires flightInstanceId
		// If no instances exist, return empty array - user needs to run seed:full to generate instances
		return results;
	}

	private dayOfWeekToMask(dow: number): number {
		// operating_days: 7 chars (Sun..Sat). We'll map Sun=0..Sat=6
		return 1 << dow;
	}

	private scheduleOperatesOn(operatingDays: string, dayMask: number): boolean {
		// Expecting format like '1111111' for each day; fallback safe
		if (!operatingDays || operatingDays.length !== 7) return true;
		const bits = operatingDays.split('').map(c => (c === '1' ? 1 : 0));
		const dow = Math.log2(dayMask);
		return bits[dow] === 1;
	}

	async getFareOptions(dto: GetFareOptionsDto): Promise<FareOptionsResponseDto> {
		// Get flight instance with aircraft and aircraft type
		const flightInstance = await this.instanceRepo
			.createQueryBuilder('fi')
			.leftJoinAndSelect('fi.aircraft', 'aircraft')
			.leftJoinAndSelect('aircraft.aircraft_type', 'aircraft_type')
			.where('fi.flight_instance_id = :id', { id: dto.flightInstanceId })
			.getOne();

		if (!flightInstance) {
			throw new NotFoundException('Flight instance not found');
		}

		if (!flightInstance.aircraft || !flightInstance.aircraft.aircraft_type) {
			throw new BadRequestException('Flight instance does not have aircraft assigned');
		}

		// Get cabin class codes for the requested cabin type
		const cabinClassCodes = this.CABIN_TYPE_MAP[dto.cabinType];
		if (!cabinClassCodes || cabinClassCodes.length === 0) {
			throw new BadRequestException(`Invalid cabin type: ${dto.cabinType}`);
		}

		// Get all fare classes for the requested cabin types
		const fareClasses = await this.fareClassRepo
			.createQueryBuilder('fare')
			.innerJoinAndSelect('fare.cabin_class', 'cabin')
			.where('cabin.cabin_class_code IN (:...codes)', { codes: cabinClassCodes })
			.getMany();

		if (fareClasses.length === 0) {
			return {
				flightInstanceId: dto.flightInstanceId,
				cabinType: dto.cabinType,
				fareOptions: [],
			};
		}

		// Get available seats for each fare class (cabin class)
		const aircraftTypeId = flightInstance.aircraft.aircraft_type.aircraft_type_id;
		const fareOptions: FareOptionDto[] = await Promise.all(
			fareClasses.map(async (fareClass) => {
				// Count available seats for this cabin class in this flight instance
				// Join FlightSeat -> SeatConfiguration -> CabinClass
				const availableSeats = await this.seatRepo
					.createQueryBuilder('seat')
					.innerJoin('seat.seat_config', 'config')
					.innerJoin('config.cabin_class', 'cabin')
					.where('seat.flight_instance_id = :instanceId', { instanceId: dto.flightInstanceId })
					.andWhere('seat.is_available = :available', { available: true })
					.andWhere('cabin.cabin_class_code = :cabinCode', { cabinCode: fareClass.cabin_class.cabin_class_code })
					.andWhere('config.aircraft_type_id = :aircraftTypeId', { aircraftTypeId })
					.getCount();

				// Get fare class display name
				const displayName = this.getFareClassName(fareClass.fare_class_code, fareClass.description);

				// Calculate price (base price logic - can be enhanced with dynamic pricing)
				const price = this.calculateFarePrice(fareClass.fare_class_code, dto.cabinType);

				// Generate description items
				const desc = this.generateFareDescriptions(fareClass.fare_class_code, dto.cabinType, fareClass.change_rule, fareClass.refund_rule);

				return {
					fareClassCode: fareClass.fare_class_code,
					name: displayName,
					typeTicket: displayName,
					price,
					availableSeats,
					desc,
					description: fareClass.description,
					changeRule: fareClass.change_rule,
					refundRule: fareClass.refund_rule,
				};
			}),
		);

		// Filter out fare options with no available seats
		const availableFareOptions = fareOptions.filter((option) => option.availableSeats > 0);

		// Sort by price (ascending)
		availableFareOptions.sort((a, b) => a.price - b.price);

		// Return fare options directly (no group wrapper needed since we only query one cabin type at a time)
		return {
			flightInstanceId: dto.flightInstanceId,
			cabinType: dto.cabinType,
			fareOptions: availableFareOptions,
		};
	}

	private generateFareDescriptions(
		fareClassCode: string,
		cabinType: CabinType,
		changeRule: string | null,
		refundRule: string | null,
	): FareDescriptionItemDto[] {
		const code = fareClassCode.toUpperCase();
		const desc: FareDescriptionItemDto[] = [];

		// Common descriptions for all fare classes
		desc.push({ text: 'Hành lý xách tay: 7kg', status: true });

		if (cabinType === CabinType.ECONOMY) {
			// Economy Saver Max
			if (code.includes('SMX') || code.includes('SAVER')) {
				desc.push({ text: 'Không bao gồm hành lý ký gửi', status: false });
				desc.push({ text: 'Không được hoàn/hủy', status: false });
				desc.push({ text: 'Thay đổi trước giờ khởi hành: 600.000 VND (*)', status: true });
				desc.push({ text: 'Không thay đổi sau giờ khởi hành (*)', status: false });
				desc.push({ text: 'Hệ số cộng điểm Bamboo Club: 0.25', status: true });
				desc.push({ text: 'Chọn ghế ngồi mất phí', status: false });
				desc.push({ text: 'Không áp dụng cho go-show', status: false });
			}
			// Economy Standard
			else if (code === 'Y') {
				desc.push({ text: 'Không bao gồm hành lý ký gửi', status: false });
				desc.push({ text: 'Hoàn/hủy trước giờ khởi hành: 400.000 VND (*)', status: true });
				desc.push({ text: 'Hoàn/hủy sau giờ khởi hành: 400.000 VND (*)', status: true });
				desc.push({ text: 'Thay đổi trước giờ khởi hành: 500.000 VND (*)', status: true });
				desc.push({ text: 'Thay đổi sau giờ khởi hành: 500.000 VND (*)', status: true });
				desc.push({ text: 'Hệ số cộng điểm Bamboo Club: 0.5', status: true });
				desc.push({ text: 'Chọn ghế ngồi mất phí', status: true });
				desc.push({ text: 'Không áp dụng cho go-show', status: false });
			}
			// Economy Smart
			else if (code.includes('SM') || code === 'YS') {
				desc.push({ text: 'Không bao gồm hành lý ký gửi', status: false });
				desc.push({ text: 'Hoàn/hủy trước giờ khởi hành: 450.000 VND (*)', status: true });
				desc.push({ text: 'Hoàn/hủy sau giờ khởi hành: 600.000 VND (*)', status: true });
				desc.push({ text: 'Thay đổi trước giờ khởi hành: 450.000 VND (*)', status: true });
				desc.push({ text: 'Thay đổi sau giờ khởi hành: 600.000 VND (*)', status: true });
				desc.push({ text: 'Hệ số cộng điểm Bamboo Club: 0.5', status: true });
				desc.push({ text: 'Chọn ghế ngồi mất phí', status: true });
				desc.push({ text: 'Không áp dụng cho go-show', status: false });
			}
			// Economy Flex
			else if (code.includes('FLX') || code.includes('FLEX') || code === 'YF') {
				desc.push({ text: '01 kiện hành lý ký gửi 20kg', status: true });
				desc.push({ text: 'Hoàn/hủy trước giờ khởi hành: 300.000 VND (*)', status: true });
				desc.push({ text: 'Hoàn/hủy sau giờ khởi hành: 300.000 VND (*)', status: true });
				desc.push({ text: 'Thay đổi miễn phí', status: true });
				desc.push({ text: 'Hệ số cộng điểm Bamboo Club: 1.00', status: true });
				desc.push({ text: 'Chọn ghế ngồi miễn phí', status: true });
				desc.push({ text: 'Đổi chuyến tại sân bay miễn phí', status: true });
			}
		} else if (cabinType === CabinType.BUSINESS) {
			// Business Smart
			if (code.includes('SM') || code === 'J' || code === 'JS') {
				desc.push({ text: '01 kiện hành lý ký gửi 30kg', status: true });
				desc.push({ text: 'Hoàn/hủy trước giờ khởi hành: 500.000 VND (*)', status: true });
				desc.push({ text: 'Hoàn/hủy sau giờ khởi hành: 800.000 VND (*)', status: true });
				desc.push({ text: 'Thay đổi trước giờ khởi hành: 500.000 VND (*)', status: true });
				desc.push({ text: 'Thay đổi sau giờ khởi hành: 800.000 VND (*)', status: true });
				desc.push({ text: 'Hệ số cộng điểm Bamboo Club: 1.5', status: true });
				desc.push({ text: 'Chọn ghế ngồi miễn phí', status: true });
				desc.push({ text: 'Ưu tiên check-in và lên máy bay', status: true });
			}
			// Business Flex
			else if (code.includes('FLX') || code.includes('FLEX') || code === 'JF') {
				desc.push({ text: '02 kiện hành lý ký gửi 30kg', status: true });
				desc.push({ text: 'Hoàn/hủy miễn phí', status: true });
				desc.push({ text: 'Thay đổi miễn phí', status: true });
				desc.push({ text: 'Hệ số cộng điểm Bamboo Club: 2.00', status: true });
				desc.push({ text: 'Chọn ghế ngồi miễn phí', status: true });
				desc.push({ text: 'Đổi chuyến tại sân bay miễn phí', status: true });
				desc.push({ text: 'Ưu tiên check-in và lên máy bay', status: true });
				desc.push({ text: 'Phòng chờ thương gia', status: true });
			}
		}

		// If we have custom rules from database, try to parse them
		if (changeRule && desc.length < 5) {
			// Could add logic to parse changeRule and refundRule if needed
		}

		return desc;
	}

	private getFareClassName(fareClassCode: string, description: string | null): string {
		// Try to get from mapping first
		if (this.FARE_CLASS_NAMES[fareClassCode]) {
			return this.FARE_CLASS_NAMES[fareClassCode];
		}

		// Try to extract from description
		if (description) {
			// Check if description contains known patterns
			if (description.toLowerCase().includes('saver max')) return 'Economy Saver Max';
			if (description.toLowerCase().includes('smart')) return 'Economy Smart';
			if (description.toLowerCase().includes('standard')) return 'Economy Standard';
			if (description.toLowerCase().includes('flex')) return 'Economy Flex';
			if (description.toLowerCase().includes('business smart')) return 'Business Smart';
			if (description.toLowerCase().includes('business flex')) return 'Business Flex';
		}

		// Fallback to description or code
		return description || fareClassCode;
	}

	private calculateFarePrice(fareClassCode: string, cabinType: CabinType): number {
		// Base pricing logic - can be enhanced with dynamic pricing from database
		// For now, using fixed prices based on fare class code patterns
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
			// Default economy price
			return 1577000;
		} else if (cabinType === CabinType.BUSINESS) {
			if (code.includes('SM') || code === 'J' || code === 'JS') {
				return 5022000; // Business Smart
			}
			if (code.includes('FLX') || code.includes('FLEX') || code === 'JF') {
				return 7074000; // Business Flex
			}
			// Default business price
			return 5022000;
		}

		return 0;
	}

	/**
	 * Get seat map for a flight instance filtered by cabin type
	 */
	async getSeatMap(dto: GetSeatMapDto): Promise<SeatMapResponseDto> {
		// Get flight instance with aircraft and aircraft type
		const flightInstance = await this.instanceRepo
			.createQueryBuilder('fi')
			.leftJoinAndSelect('fi.aircraft', 'aircraft')
			.leftJoinAndSelect('aircraft.aircraft_type', 'aircraft_type')
			.where('fi.flight_instance_id = :id', { id: dto.flightInstanceId })
			.getOne();

		if (!flightInstance) {
			throw new NotFoundException('Flight instance not found');
		}

		if (!flightInstance.aircraft || !flightInstance.aircraft.aircraft_type) {
			throw new BadRequestException('Flight instance does not have aircraft assigned');
		}

		// Get cabin class codes for the requested cabin type
		const cabinClassCodes = this.CABIN_TYPE_MAP[dto.cabinType];
		if (!cabinClassCodes || cabinClassCodes.length === 0) {
			throw new BadRequestException(`Invalid cabin type: ${dto.cabinType}`);
		}

		// Get all seats for this flight instance filtered by cabin class
		const aircraftTypeId = flightInstance.aircraft.aircraft_type.aircraft_type_id;
		const seats = await this.seatRepo
			.createQueryBuilder('seat')
			.innerJoinAndSelect('seat.seat_config', 'config')
			.innerJoinAndSelect('config.cabin_class', 'cabin')
			.where('seat.flight_instance_id = :instanceId', { instanceId: dto.flightInstanceId })
			.andWhere('cabin.cabin_class_code IN (:...codes)', { codes: cabinClassCodes })
			.andWhere('config.aircraft_type_id = :aircraftTypeId', { aircraftTypeId })
			.orderBy('seat.seat_number', 'ASC')
			.getMany();

		// Get all fare classes for this cabin type to map note codes
		const fareClasses = await this.fareClassRepo
			.createQueryBuilder('fare')
			.innerJoinAndSelect('fare.cabin_class', 'cabin')
			.where('cabin.cabin_class_code IN (:...codes)', { codes: cabinClassCodes })
			.getMany();

		// Create fare class code to note mapping
		const fareClassNoteMap = new Map<string, string>();
		fareClasses.forEach((fareClass) => {
			const note = this.getFareClassNote(fareClass.fare_class_code, dto.cabinType);
			fareClassNoteMap.set(fareClass.fare_class_code, note);
		});

		// Group seats by cabin class and convert to DTOs
		const seatGroups = new Map<string, SeatDto[]>();
		
		for (const seat of seats) {
			const cabinCode = seat.seat_config.cabin_class.cabin_class_code;
			if (!seatGroups.has(cabinCode)) {
				seatGroups.set(cabinCode, []);
			}

			// Determine position (left or right) based on seat number
			const position = this.determineSeatPosition(seat.seat_number, dto.cabinType);

			// Get note code from fare class (default to first fare class note for this cabin)
			// In real scenario, we might need to map seat to specific fare class
			// For now, we'll use a default note based on cabin type
			const defaultNote = dto.cabinType === CabinType.BUSINESS ? 'bf' : 'ef';
			const note = fareClassNoteMap.size > 0 
				? Array.from(fareClassNoteMap.values())[0] 
				: defaultNote;

			const seatDto: SeatDto = {
				flightSeatId: seat.flight_seat_id,
				seatNumber: seat.seat_number,
				cabinClassCode: cabinCode,
				seatType: seat.seat_config.seat_type,
				isExitRow: seat.seat_config.is_exit_row,
				position,
				isAvailable: seat.is_available,
				note,
			};

			seatGroups.get(cabinCode)!.push(seatDto);
		}

		// Convert to response format
		const seatMapGroups: SeatMapGroupDto[] = [];
		for (const [cabinCode, seatList] of seatGroups.entries()) {
			const groupId = cabinCode === 'J' ? 'business' : 'economy';
			seatMapGroups.push({
				id: groupId as 'business' | 'economy',
				list: seatList,
			});
		}

		return {
			flightInstanceId: dto.flightInstanceId,
			flightNumber: flightInstance.flight_number,
			cabinType: dto.cabinType,
			seats: seatMapGroups,
		};
	}

	/**
	 * Determine seat position (left or right) based on seat number and cabin type
	 * Business: 2-2 config (A-B | C-D) -> A,B = left, C,D = right
	 * Economy: 3-3 config (A-B-C | D-E-F) -> A,B,C = left, D,E,F = right
	 */
	private determineSeatPosition(seatNumber: string, cabinType: CabinType): 'left' | 'right' {
		// Extract letter from seat number (e.g., "A1" -> "A", "10C" -> "C")
		const letterMatch = seatNumber.match(/[A-Z]/i);
		if (!letterMatch) {
			// Default to left if can't parse
			return 'left';
		}

		const letter = letterMatch[0].toUpperCase();

		if (cabinType === CabinType.BUSINESS) {
			// Business: A-B = left, C-D = right
			return letter <= 'B' ? 'left' : 'right';
		} else {
			// Economy: A-B-C = left, D-E-F = right
			return letter <= 'C' ? 'left' : 'right';
		}
	}

	/**
	 * Get fare class note code (bf, ef, es, em) based on fare class code and cabin type
	 */
	private getFareClassNote(fareClassCode: string, cabinType: CabinType): string {
		const code = fareClassCode.toUpperCase();

		if (cabinType === CabinType.BUSINESS) {
			if (code.includes('FLX') || code.includes('FLEX') || code === 'JF') {
				return 'bf'; // Business Flex
			}
			return 'bs'; // Business Smart (default)
		} else {
			// Economy
			if (code.includes('FLX') || code.includes('FLEX') || code === 'YF') {
				return 'ef'; // Economy Flex
			}
			if (code === 'Y') {
				return 'es'; // Economy Standard (use same note as Smart)
			}
			if (code.includes('SM') || code === 'YS') {
				return 'es'; // Economy Smart
			}
			if (code.includes('SMX') || code.includes('SAVER')) {
				return 'em'; // Economy Saver Max
			}
			return 'ef'; // Default to Economy Flex
		}
	}
}
