import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Airport } from 'src/shared/entities/airport/airport.entity';
import { Route } from 'src/shared/entities/route/route.entity';
import { FlightInstance } from 'src/shared/entities/flight/flight-instance.entity';
import { FlightSeat } from 'src/shared/entities/flight/flight-seat.entity';
import { FlightSchedule } from 'src/shared/entities/flight/flight-schedule.entity';
import { SearchFlightsDto, TripType } from './dto/search-flights.dto';
import { FlightResult } from './types/flight-result.type';

@Injectable()
export class SearchService {
	constructor(
		@InjectRepository(Airport) private readonly airportRepo: Repository<Airport>,
		@InjectRepository(Route) private readonly routeRepo: Repository<Route>,
		@InjectRepository(FlightInstance) private readonly instanceRepo: Repository<FlightInstance>,
		@InjectRepository(FlightSeat) private readonly seatRepo: Repository<FlightSeat>,
		@InjectRepository(FlightSchedule) private readonly scheduleRepo: Repository<FlightSchedule>,
	) {}

	async search(dto: SearchFlightsDto) {
		const totalPax = dto.adults + dto.minors;
		const [origin, destination] = await Promise.all([
			this.airportRepo.findOne({ where: { iata_code: dto.origin.toUpperCase() } }),
			this.airportRepo.findOne({ where: { iata_code: dto.destination.toUpperCase() } }),
		]);
		if (!origin) throw new NotFoundException('Origin airport not found');
		if (!destination) throw new NotFoundException('Destination airport not found');

		// Query route bằng QueryBuilder vì origin_airport_id, destination_airport_id là @RelationId properties
		const route = await this.routeRepo
			.createQueryBuilder('route')
			.where('route.origin_airport_id = :originId', { originId: origin.airport_id })
			.andWhere('route.destination_airport_id = :destId', { destId: destination.airport_id })
			.andWhere('route.is_domestic = :domestic', { domestic: true })
			.getOne();
		if (!route) throw new NotFoundException('No domestic route for selected airports');

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
		// Prefer concrete instances on the exact date
		const instances = await this.instanceRepo.createQueryBuilder('fi')
			.innerJoin('fi.flight_schedule', 'fs')
			.where('fs.route_id = :routeId', { routeId })
			.andWhere('CAST(fi.flight_date as date) = :date', { date: date.toISOString().slice(0, 10) })
			.andWhere('fi.status IN (:...st)', { st: ['scheduled', 'on_time'] })
			.orderBy('fi.departure_datetime_local', 'ASC')
			.getMany();

		const withAvailability = await Promise.all(instances.map(async (fi) => {
			const availableSeats = await this.seatRepo.count({
				where: { flight_instance_id: fi.flight_instance_id, is_available: true },
			});
			return { fi, availableSeats };
		}));

		let results: FlightResult[] = withAvailability
			.filter(x => x.availableSeats >= minSeats)
			.map(x => ({
				flightInstanceId: x.fi.flight_instance_id,
				flightNumber: x.fi.flight_number,
				departureLocal: x.fi.departure_datetime_local,
				arrivalLocal: x.fi.arrival_datetime_local,
				availableSeats: x.availableSeats,
				origin: { iata: origin.iata_code, name: origin.name, city: origin.city },
				destination: { iata: destination.iata_code, name: destination.name, city: destination.city },
			}));

		// Fallback to schedules if no instances exist for that date (e.g., pre-generation not done)
		if (results.length === 0) {
			const dow = date.getUTCDay(); // 0..6 (Sun..Sat)
			const dayMask = this.dayOfWeekToMask(dow);
			const schedules = await this.scheduleRepo.createQueryBuilder('fs')
				.where('fs.route_id = :routeId', { routeId })
				.andWhere('fs.effective_from <= :date AND fs.effective_to >= :date', { date: date.toISOString().slice(0, 10) })
				.getMany();

			results = schedules
				.filter(s => this.scheduleOperatesOn(s.operating_days, dayMask))
				.map(s => {
					// build datetime from local times (assuming local timezone handling at FE)
					const dep = new Date(`${date.toISOString().slice(0, 10)}T${s.departure_time_local}`);
					const arr = new Date(`${date.toISOString().slice(0, 10)}T${s.arrival_time_local}`);
					return {
						flightInstanceId: '',
						flightNumber: s.flight_number,
						departureLocal: dep,
						arrivalLocal: arr,
						availableSeats: 999, // unknown capacity at schedule level
						origin: { iata: origin.iata_code, name: origin.name, city: origin.city },
						destination: { iata: destination.iata_code, name: destination.name, city: destination.city },
					} as FlightResult;
				});
		}
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
}
