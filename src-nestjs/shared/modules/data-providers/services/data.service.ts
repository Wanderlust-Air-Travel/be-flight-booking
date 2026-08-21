import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { AircraftType } from 'src/api-gateway/data-access/entities/aircraft/aircraft-type.entity';
import { Airline } from 'src/api-gateway/data-access/entities/airline/airline.entity';
import { RouteFarePrice } from 'src/api-gateway/data-access/entities/fare/route-fare-price.entity';
import { FlightInstance } from 'src/api-gateway/data-access/entities/flight/flight-instance.entity';
import { Route } from 'src/api-gateway/data-access/entities/route/route.entity';
import type { Repository } from 'typeorm';
import { RedisService } from '../../../modules/redis/redis.service';
import type {
    AircraftDto,
    AirlineDto,
    AirportDto,
    FlightOfferDto,
    FlightSearchParams,
    FlightSearchResultDto,
} from '../interfaces/data-provider.dto';
import { OurairportsProvider } from '../providers/ourairports.provider';

@Injectable()
export class DataService implements OnModuleInit {
    private readonly logger = new Logger(DataService.name);

    private readonly CACHE_KEYS = {
        AIRPORTS: 'data:airports',
        AIRLINES: 'data:airlines',
        AIRCRAFT: 'data:aircraft',
        AIRPORTS_STAMP: 'data:airports:stamp',
    };

    private readonly CACHE_TTL_LIVE = 300;

    constructor(
        private readonly ourProvider: OurairportsProvider,
        private readonly redis: RedisService,
        private readonly configService: ConfigService,
        @InjectRepository(Airline)
        private readonly airlineRepository: Repository<Airline>,
        @InjectRepository(AircraftType)
        private readonly aircraftTypeRepository: Repository<AircraftType>,
        @InjectRepository(FlightInstance)
        private readonly flightInstanceRepository: Repository<FlightInstance>,
        @InjectRepository(Route)
        private readonly routeRepository: Repository<Route>,
        @InjectRepository(RouteFarePrice)
        private readonly routeFarePriceRepository: Repository<RouteFarePrice>
    ) {}

    async onModuleInit(): Promise<void> {
        const syncOnStartup =
            this.configService.get<boolean>('dataBootstrap.syncOnStartup') ?? false;
        if (syncOnStartup) {
            await this.bootstrap();
        }
    }

    async bootstrap(): Promise<void> {
        this.printBanner();

        try {
            const airports = await this.getAirports();
            const airlines = await this.getAirlines();
            const aircraft = await this.getAircraft();

            console.log(`\n  ✓ Loaded ${airports.length} airports`);
            console.log(`  ✓ Loaded ${airlines.length} airlines`);
            console.log(`  ✓ Loaded ${aircraft.length} aircraft`);
            console.log('\n  ✓ DATA BOOTSTRAP COMPLETE\n');
        } catch (error) {
            this.logger.error('Bootstrap failed:', error);
        }
    }

    async getAirports(forceRefresh = false): Promise<AirportDto[]> {
        if (!forceRefresh) {
            const cached = await this.redis.get<AirportDto[]>(this.CACHE_KEYS.AIRPORTS);
            if (cached) {
                this.logger.log(`Airports cache hit (${cached.length} airports)`);
                return cached;
            }
        }

        this.logger.log('Fetching airports from OurAirports...');
        const airports = await this.ourProvider.getAirports();

        await this.redis.set(this.CACHE_KEYS.AIRPORTS, airports);
        await this.redis.set(this.CACHE_KEYS.AIRPORTS_STAMP, new Date().toISOString());

        return airports;
    }

    async getAirlines(forceRefresh = false): Promise<AirlineDto[]> {
        if (!forceRefresh) {
            const cached = await this.redis.get<AirlineDto[]>(this.CACHE_KEYS.AIRLINES);
            if (cached) {
                this.logger.debug(`Airlines cache hit (${cached.length} airlines)`);
                return cached;
            }
        }

        this.logger.log('Fetching airlines from database...');
        const airlines = await this.airlineRepository.find({
            order: { name: 'ASC' },
        });

        const airlineDtos: AirlineDto[] = airlines.map((airline) => ({
            iata_code: airline.iata_code,
            icao_code: airline.icao_code ?? '',
            name: airline.name,
            callsign: airline.callsign ?? undefined,
            country: airline.country ?? undefined,
        }));

        await this.redis.set(this.CACHE_KEYS.AIRLINES, airlineDtos);
        return airlineDtos;
    }

    async getAircraft(forceRefresh = false): Promise<AircraftDto[]> {
        if (!forceRefresh) {
            const cached = await this.redis.get<AircraftDto[]>(this.CACHE_KEYS.AIRCRAFT);
            if (cached) {
                this.logger.debug(`Aircraft cache hit (${cached.length} aircraft types)`);
                return cached;
            }
        }

        this.logger.log('Fetching aircraft types from database...');
        const aircraftTypes = await this.aircraftTypeRepository.find({
            order: { code: 'ASC' },
        });

        const aircraftDtos: AircraftDto[] = aircraftTypes.map((at) => ({
            iata_code: at.code,
            name: `${at.manufacturer} ${at.model}`,
            category: at.total_seats > 250 ? 'widebody' : 'narrowbody',
        }));

        await this.redis.set(this.CACHE_KEYS.AIRCRAFT, aircraftDtos);
        return aircraftDtos;
    }

    async searchFlights(params: FlightSearchParams): Promise<FlightSearchResultDto> {
        const cacheKey = `data:search:${params.origin}:${params.destination}:${params.departureDate}`;

        const cached = await this.redis.get<FlightSearchResultDto>(cacheKey);
        if (cached) {
            this.logger.log(`Search cache hit for ${params.origin}-${params.destination}`);
            return cached;
        }

        this.logger.log(
            `Searching flights from database: ${params.origin} -> ${params.destination} on ${params.departureDate}`
        );

        const departureDate = new Date(params.departureDate);
        departureDate.setHours(0, 0, 0, 0);

        const nextDay = new Date(departureDate);
        nextDay.setDate(nextDay.getDate() + 1);

        const cabinClassFilter = params.cabinClass?.toUpperCase() || 'Y';
        const cabinClassCode =
            cabinClassFilter === 'ECONOMY'
                ? 'Y'
                : cabinClassFilter === 'BUSINESS'
                  ? 'J'
                  : cabinClassFilter === 'FIRST'
                    ? 'F'
                    : cabinClassFilter;

        const queryBuilder = this.flightInstanceRepository
            .createQueryBuilder('fi')
            .innerJoinAndSelect('fi.flight_schedule', 'fs')
            .innerJoinAndSelect('fs.route', 'route')
            .innerJoinAndSelect('route.origin_airport', 'origin')
            .innerJoinAndSelect('route.destination_airport', 'destination')
            .innerJoinAndSelect('fs.aircraft_type', 'aircraftType')
            .innerJoinAndSelect('fi.aircraft', 'aircraft')
            .leftJoin(
                RouteFarePrice,
                'rfp',
                'rfp.route_id = route.route_id AND rfp.fare_class_code = :cabinClassCode',
                { cabinClassCode }
            )
            .addSelect('rfp.base_price')
            .where('origin.iata_code = :origin', { origin: params.origin })
            .andWhere('destination.iata_code = :destination', { destination: params.destination })
            .andWhere('fi.flight_date >= :departureDate', { departureDate })
            .andWhere('fi.flight_date < :nextDay', { nextDay })
            .andWhere('fi.status = :status', { status: 'scheduled' })
            .orderBy('fi.departure_datetime_local', 'ASC');

        const results = await queryBuilder.getRawAndEntities();
        const flights = results.entities as FlightInstance[];
        const rawPrices = results.raw as unknown as Array<{ rfp_base_price: number | null }>;

        const passengerCount = (params.adults || 1) + (params.children || 0);
        const cabinMultiplier = cabinClassCode === 'J' ? 3 : cabinClassCode === 'F' ? 5 : 1;

        const flightOffers: FlightOfferDto[] = flights.map((flight, index) => {
            const basePrice =
                rawPrices[index]?.rfp_base_price != null
                    ? Number(rawPrices[index].rfp_base_price)
                    : 500000 + index * 350000;

            const flightNumber = flight.flight_schedule?.flight_number || flight.flight_number;
            const airlineCode = flightNumber.substring(0, 2);

            return {
                id: `${flightNumber}_${params.departureDate}`,
                origin: params.origin,
                destination: params.destination,
                departureTime: new Date(flight.departure_datetime_local).toISOString(),
                arrivalTime: new Date(flight.arrival_datetime_local).toISOString(),
                duration: this.calculateDuration(
                    new Date(flight.departure_datetime_local),
                    new Date(flight.arrival_datetime_local)
                ),
                airline: airlineCode,
                flightNumber: flightNumber,
                aircraft: flight.flight_schedule?.aircraft_type?.code || undefined,
                stops: 0,
                price: {
                    total: basePrice * cabinMultiplier * passengerCount,
                    currency: 'VND',
                },
                seatsAvailable: 20 + index * 15,
            };
        });

        const result: FlightSearchResultDto = {
            flights: flightOffers,
            currency: 'VND',
            totalResults: flightOffers.length,
            provider: 'database',
        };

        await this.redis.set(cacheKey, result, this.CACHE_TTL_LIVE);
        return result;
    }

    async checkHealth(): Promise<{ provider: string; available: boolean; latencyMs: number }[]> {
        const results: { provider: string; available: boolean; latencyMs: number }[] = [];

        const start = Date.now();
        const ourAvailable = await this.ourProvider.isAvailable();
        results.push({
            provider: 'OurAirports',
            available: ourAvailable,
            latencyMs: Date.now() - start,
        });

        const dbStart = Date.now();
        try {
            await this.airlineRepository.count();
            results.push({
                provider: 'Database',
                available: true,
                latencyMs: Date.now() - dbStart,
            });
        } catch {
            results.push({
                provider: 'Database',
                available: false,
                latencyMs: Date.now() - dbStart,
            });
        }

        return results;
    }

    async clearCache(): Promise<void> {
        const keys = await this.redis.keys('data:*');
        for (const key of keys) {
            await this.redis.del(key);
        }
        this.logger.log('Data cache cleared');
    }

    private calculateDuration(departure: Date, arrival: Date): string {
        const diffMs = arrival.getTime() - departure.getTime();
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        return `PT${hours}H${minutes}M`;
    }

    private printBanner(): void {
        console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║  DATA BOOTSTRAP                                                          ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Source: OurAirports (airports) + Database (airlines, aircraft, flights) ║
╚══════════════════════════════════════════════════════════════════════════════╝
        `);
    }
}
