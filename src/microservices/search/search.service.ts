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
import { FarePricingService } from 'src/shared/services/fare-pricing.service';
import { FareDescriptionRule } from 'src/shared/entities/fare/fare-description-rule.entity';
import { Logger } from '@nestjs/common';

@Injectable()
export class SearchService {
	private readonly logger = new Logger(SearchService.name);
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
		'J': 'Business Standard',
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
		@InjectRepository(FareDescriptionRule) private readonly fareDescriptionRuleRepo: Repository<FareDescriptionRule>,
		private readonly farePricingService: FarePricingService,
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

		// Calculate available seats for each instance, grouped by cabin type
		const withAvailability = await Promise.all(instances.map(async (fi) => {
			// Get total available seats
			const availableSeats = await this.seatRepo
				.createQueryBuilder('seat')
				.where('seat.flight_instance_id = :instanceId', { instanceId: fi.flight_instance_id })
				.andWhere('seat.is_available = :available', { available: true })
				.getCount();

			// Get available seats by cabin type
			const cabinTypeSeats = await this.seatRepo
				.createQueryBuilder('seat')
				.innerJoin('seat.seat_config', 'sc')
				.innerJoin('sc.cabin_class', 'cc')
				.where('seat.flight_instance_id = :instanceId', { instanceId: fi.flight_instance_id })
				.andWhere('seat.is_available = :available', { available: true })
				.select('cc.cabin_class_code', 'cabinClassCode')
				.addSelect('COUNT(seat.flight_seat_id)', 'count')
				.groupBy('cc.cabin_class_code')
				.getRawMany();

			// Map cabin class codes to cabin types
			const cabinTypes: { cabinType: string; availableSeats: number }[] = [];
			for (const row of cabinTypeSeats) {
				const cabinClassCode = row.cabinClassCode;
				const count = parseInt(row.count, 10);
				
				// Map cabin class code to cabin type
				let cabinType: string;
				if (cabinClassCode === 'Y') {
					cabinType = CabinType.ECONOMY;
				} else if (cabinClassCode === 'J') {
					cabinType = CabinType.BUSINESS;
				} else if (cabinClassCode === 'F') {
					cabinType = CabinType.FIRST;
				} else {
					// Skip unknown cabin class codes
					continue;
				}

				// Only include cabin types with available seats >= minSeats
				if (count >= minSeats) {
					cabinTypes.push({ cabinType, availableSeats: count });
				}
			}

			console.log(`[DEBUG] Flight ${fi.flight_number} (${fi.flight_instance_id}): ${availableSeats} total available seats, cabin types: ${JSON.stringify(cabinTypes)}`);
			return { fi, availableSeats, cabinTypes };
		}));

		// Map to FlightResult, only include flights with valid flightInstanceId and enough seats
		const results: FlightResult[] = withAvailability
			.filter(x => {
				const hasEnoughSeats = x.availableSeats >= minSeats;
				const hasValidId = !!x.fi.flight_instance_id;
				const hasAvailableCabinTypes = x.cabinTypes.length > 0;
				if (!hasEnoughSeats) {
					console.log(`[DEBUG] Filtered out ${x.fi.flight_number}: only ${x.availableSeats} seats (need ${minSeats})`);
				}
				if (!hasValidId) {
					console.log(`[DEBUG] Filtered out ${x.fi.flight_number}: no flight_instance_id`);
				}
				if (!hasAvailableCabinTypes) {
					console.log(`[DEBUG] Filtered out ${x.fi.flight_number}: no cabin types with enough seats`);
				}
				return hasEnoughSeats && hasValidId && hasAvailableCabinTypes;
			})
			.map(x => ({
				flightInstanceId: x.fi.flight_instance_id,
				flightNumber: x.fi.flight_number,
				departureLocal: x.fi.departure_datetime_local,
				arrivalLocal: x.fi.arrival_datetime_local,
				availableSeats: x.availableSeats,
				origin: { iata: origin.iata_code, name: origin.name, city: origin.city },
				destination: { iata: destination.iata_code, name: destination.name, city: destination.city },
				cabinTypes: x.cabinTypes,
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
		// Use DISTINCT to avoid duplicates if there are multiple entries with same fare_class_code
		const fareClasses = await this.fareClassRepo
			.createQueryBuilder('fare')
			.innerJoinAndSelect('fare.cabin_class', 'cabin')
			.where('cabin.cabin_class_code IN (:...codes)', { codes: cabinClassCodes })
			.distinct(true)
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

				// Generate description items from database
				const desc = await this.generateFareDescriptions(fareClass.fare_class_code, dto.cabinType, fareClass.change_rule, fareClass.refund_rule);

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

		// Step 1: Remove duplicates based on fare_class_code (keep option with highest available seats)
		// This handles true duplicates where same fare class code appears multiple times
		const fareOptionsByCode = new Map<string, FareOptionDto>();
		for (const option of availableFareOptions) {
			const existing = fareOptionsByCode.get(option.fareClassCode);
			if (!existing || option.availableSeats > existing.availableSeats) {
				fareOptionsByCode.set(option.fareClassCode, option);
			}
		}
		let uniqueFareOptions = Array.from(fareOptionsByCode.values());

		// Step 2: Handle fare class variants with same display name and price
		// Business rule: If multiple fare classes have identical name, price, and descriptions,
		// keep only the primary variant (shorter code = primary, e.g., "JF" over "JFLX")
		// However, if descriptions differ, keep both as they represent different products
		const namePriceKeyMap = new Map<string, FareOptionDto[]>();
		for (const option of uniqueFareOptions) {
			const key = `${option.name}|${option.price}`;
			if (!namePriceKeyMap.has(key)) {
				namePriceKeyMap.set(key, []);
			}
			namePriceKeyMap.get(key)!.push(option);
		}

		const finalFareOptions: FareOptionDto[] = [];
		for (const [key, options] of namePriceKeyMap.entries()) {
			if (options.length === 1) {
				// No duplicates, keep as is
				finalFareOptions.push(options[0]);
			} else {
				// Multiple options with same name+price
				// Check if they have identical descriptions
				const descriptionsByOption = options.map(opt => 
					JSON.stringify(opt.desc.sort((a, b) => a.text.localeCompare(b.text)))
				);
				const allSameDescriptions = descriptionsByOption.every(desc => desc === descriptionsByOption[0]);

				if (allSameDescriptions) {
					// All have identical descriptions - keep only primary (shortest code)
					const primary = options.reduce((prev, curr) => 
						curr.fareClassCode.length < prev.fareClassCode.length ? curr : prev
					);
					finalFareOptions.push(primary);
				} else {
					// Different descriptions - keep all as they represent different products
					finalFareOptions.push(...options);
				}
			}
		}

		uniqueFareOptions = finalFareOptions;

		// Sort by price (ascending)
		uniqueFareOptions.sort((a, b) => a.price - b.price);

		// Return fare options directly (no group wrapper needed since we only query one cabin type at a time)
		return {
			flightInstanceId: dto.flightInstanceId,
			cabinType: dto.cabinType,
			fareOptions: uniqueFareOptions,
		};
	}

	/**
	 * Generate fare descriptions based on fare class code from database
	 */
	private async generateFareDescriptions(
		fareClassCode: string,
		cabinType: CabinType,
		changeRule: string | null,
		refundRule: string | null,
	): Promise<FareDescriptionItemDto[]> {
		const code = fareClassCode.toUpperCase();
		const desc: FareDescriptionItemDto[] = [];

		// Convert CabinType enum to string for database query
		const cabinTypeString = cabinType === CabinType.ECONOMY ? 'economy' : 
		                        cabinType === CabinType.BUSINESS ? 'business' : 'economy';

		try {
			// Get all active rules for this cabin type
			const allRules = await this.fareDescriptionRuleRepo.find({
				where: {
					cabin_type: cabinTypeString,
					is_active: true,
				},
				order: {
					display_order: 'ASC',
				},
			});

			// Use Set to track unique descriptions (text + status combination)
			const seenDescriptions = new Set<string>();

			// First, add default rules (like "Hành lý xách tay: 7kg")
			const defaultRules = allRules.filter((rule) => rule.is_default);
			for (const rule of defaultRules) {
				const key = `${rule.description_text}|${rule.status}`;
				if (!seenDescriptions.has(key)) {
					desc.push({
						text: rule.description_text,
						status: rule.status,
					});
					seenDescriptions.add(key);
				}
			}

			// Then, find matching rules based on fare class code pattern
			// Use hierarchical matching: exact > prefix > contains (all with longest-first priority)
			const exactMatchRules: FareDescriptionRule[] = [];
			const prefixMatchRules = new Map<string, FareDescriptionRule[]>(); // pattern -> rules
			const containsMatchRules = new Map<string, FareDescriptionRule[]>(); // pattern -> rules
			
			for (const rule of allRules) {
				if (rule.is_default) continue; // Skip default rules, already added

				const pattern = rule.fare_class_code_pattern.toUpperCase();

				// 1. Exact match (highest priority)
				if (code === pattern) {
					exactMatchRules.push(rule);
				}
				// 2. Prefix match (code starts with pattern) - more specific than contains
				else if (code.startsWith(pattern)) {
					if (!prefixMatchRules.has(pattern)) {
						prefixMatchRules.set(pattern, []);
					}
					prefixMatchRules.get(pattern)!.push(rule);
				}
				// 3. Contains match (code contains pattern) - least specific
				else if (code.includes(pattern)) {
					if (!containsMatchRules.has(pattern)) {
						containsMatchRules.set(pattern, []);
					}
					containsMatchRules.get(pattern)!.push(rule);
				}
			}

			// Select rules based on hierarchy: exact > longest prefix > longest contains
			let selectedRules: FareDescriptionRule[] = [];

			if (exactMatchRules.length > 0) {
				// Use exact match rules
				selectedRules = exactMatchRules;
			} else if (prefixMatchRules.size > 0) {
				// Use longest prefix match
				let longestPrefix = '';
				for (const pattern of prefixMatchRules.keys()) {
					if (pattern.length > longestPrefix.length) {
						longestPrefix = pattern;
					}
				}
				selectedRules = prefixMatchRules.get(longestPrefix)!;
			} else if (containsMatchRules.size > 0) {
				// Use longest contains match
				let longestContains = '';
				for (const pattern of containsMatchRules.keys()) {
					if (pattern.length > longestContains.length) {
						longestContains = pattern;
					}
				}
				selectedRules = containsMatchRules.get(longestContains)!;
			}

			// Sort selected rules by display_order
			if (selectedRules.length > 0) {
				selectedRules.sort((a, b) => a.display_order - b.display_order);
				
				// Add matching rules to descriptions, avoiding duplicates
				for (const rule of selectedRules) {
					const key = `${rule.description_text}|${rule.status}`;
					if (!seenDescriptions.has(key)) {
						desc.push({
							text: rule.description_text,
							status: rule.status,
						});
						seenDescriptions.add(key);
					}
				}
			}
		} catch (error) {
			this.logger.error(`Error fetching fare description rules for ${fareClassCode}/${cabinTypeString}:`, error);
			// Fallback: return default description if database query fails
			desc.push({ text: 'Hành lý xách tay: 7kg', status: true });
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
			if (description.toLowerCase().includes('standard')) {
				// Check if it's Business or Economy Standard
				if (description.toLowerCase().includes('business')) return 'Business Standard';
				return 'Economy Standard';
			}
			if (description.toLowerCase().includes('flex')) return 'Economy Flex';
			if (description.toLowerCase().includes('business smart')) return 'Business Smart';
			if (description.toLowerCase().includes('business flex')) return 'Business Flex';
		}

		// Fallback to description or code
		return description || fareClassCode;
	}

	/**
	 * @deprecated Use FarePricingService.calculateBaseFare() instead
	 * Kept for backward compatibility only
	 */
	private calculateFarePrice(fareClassCode: string, cabinType: CabinType): number {
		// This method is deprecated - use FarePricingService instead
		// Kept for backward compatibility
		return this.farePricingService['getFallbackPrice'](fareClassCode, cabinType);
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

		// Get cabin class codes for the requested cabin type (for determining selectability)
		const requestedCabinClassCodes = this.CABIN_TYPE_MAP[dto.cabinType];
		if (!requestedCabinClassCodes || requestedCabinClassCodes.length === 0) {
			throw new BadRequestException(`Invalid cabin type: ${dto.cabinType}`);
		}

		// Get ALL seats for this flight instance (both economy and business)
		// This ensures frontend can display both cabin sections even if user selected one cabin type
		const aircraftTypeId = flightInstance.aircraft.aircraft_type.aircraft_type_id;
		const allSeats = await this.seatRepo
			.createQueryBuilder('seat')
			.innerJoinAndSelect('seat.seat_config', 'config')
			.innerJoinAndSelect('config.cabin_class', 'cabin')
			.where('seat.flight_instance_id = :instanceId', { instanceId: dto.flightInstanceId })
			.andWhere('cabin.cabin_class_code IN (:...codes)', { codes: ['Y', 'J'] }) // Get both economy (Y) and business (J)
			.andWhere('config.aircraft_type_id = :aircraftTypeId', { aircraftTypeId })
			.orderBy('seat.seat_number', 'ASC')
			.getMany();

		// Get all fare classes for both economy and business to map note codes
		const allFareClasses = await this.fareClassRepo
			.createQueryBuilder('fare')
			.innerJoinAndSelect('fare.cabin_class', 'cabin')
			.where('cabin.cabin_class_code IN (:...codes)', { codes: ['Y', 'J'] })
			.getMany();

		// Create fare class code to note mapping for both cabin types
		const fareClassNoteMap = new Map<string, string>();
		allFareClasses.forEach((fareClass) => {
			const cabinType = fareClass.cabin_class.cabin_class_code === 'J' ? CabinType.BUSINESS : CabinType.ECONOMY;
			const note = this.getFareClassNote(fareClass.fare_class_code, cabinType);
			fareClassNoteMap.set(fareClass.fare_class_code, note);
		});

		// Group fare classes by cabin class for easier note lookup
		const fareClassesByCabin = new Map<string, FareClass[]>();
		allFareClasses.forEach((fareClass) => {
			const cabinCode = fareClass.cabin_class.cabin_class_code;
			if (!fareClassesByCabin.has(cabinCode)) {
				fareClassesByCabin.set(cabinCode, []);
			}
			fareClassesByCabin.get(cabinCode)!.push(fareClass);
		});

		// Group seats by cabin class and convert to DTOs
		const seatGroups = new Map<string, SeatDto[]>();
		
		for (const seat of allSeats) {
			const cabinCode = seat.seat_config.cabin_class.cabin_class_code;
			if (!seatGroups.has(cabinCode)) {
				seatGroups.set(cabinCode, []);
			}

			// Determine if this seat is selectable based on requested cabin type
			const isSelectable = requestedCabinClassCodes.includes(cabinCode) && seat.is_available;

			// Determine position (left or right) based on seat number
			// Use the seat's actual cabin type for position determination
			const seatCabinType = cabinCode === 'J' ? CabinType.BUSINESS : CabinType.ECONOMY;
			const position = this.determineSeatPosition(seat.seat_number, seatCabinType);

			// Get note code from fare class for this cabin class
			// Use first available fare class note for this cabin, or default
			const defaultNote = cabinCode === 'J' ? 'bf' : 'ef';
			let note = defaultNote;
			const cabinFareClasses = fareClassesByCabin.get(cabinCode);
			if (cabinFareClasses && cabinFareClasses.length > 0) {
				// Get note from first fare class of this cabin
				const firstFareClass = cabinFareClasses[0];
				note = fareClassNoteMap.get(firstFareClass.fare_class_code) || defaultNote;
			}

			const seatDto: SeatDto = {
				flightSeatId: seat.flight_seat_id,
				seatNumber: seat.seat_number,
				cabinClassCode: cabinCode,
				seatType: seat.seat_config.seat_type,
				isExitRow: seat.seat_config.is_exit_row,
				position,
				isAvailable: seat.is_available,
				note,
				isSelectable,
			};

			seatGroups.get(cabinCode)!.push(seatDto);
		}

		// Convert to response format - ensure both economy and business groups exist
		const seatMapGroups: SeatMapGroupDto[] = [];
		
		// Always include economy group (even if empty)
		const economySeats = seatGroups.get('Y') || [];
		seatMapGroups.push({
			id: 'economy',
			list: economySeats,
		});

		// Always include business group (even if empty)
		const businessSeats = seatGroups.get('J') || [];
		seatMapGroups.push({
			id: 'business',
			list: businessSeats,
		});

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

	/**
	 * Get list of all airports for frontend dropdown selection
	 * Returns airports sorted by city name
	 */
	async getAirports() {
		const airports = await this.airportRepo.find({
			order: {
				city: 'ASC',
			},
		});

		// Transform to frontend format
		return airports.map((airport) => {
			// Generate slug value from city name (Vietnamese to slug)
			const citySlug = airport.city
				.toLowerCase()
				.normalize('NFD')
				.replace(/[\u0300-\u036f]/g, '') // Remove diacritics
				.replace(/đ/g, 'd')
				.replace(/Đ/g, 'D')
				.replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
				.replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

			return {
				iata: airport.iata_code,
				name: airport.name,
				city: airport.city,
				value: citySlug,
			};
		});
	}
}
