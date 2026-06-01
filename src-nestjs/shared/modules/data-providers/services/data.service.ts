import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OurairportsProvider } from '../providers/ourairports.provider';
import { MockProvider } from '../providers/mock.provider';
import { RedisService } from '../../../modules/redis/redis.service';
import {
  AirportDto,
  AirlineDto,
  AircraftDto,
  FlightSearchParams,
  FlightSearchResultDto,
} from '../interfaces/data-provider.dto';

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
    private readonly mockProvider: MockProvider,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const syncOnStartup = this.configService.get<boolean>('dataBootstrap.syncOnStartup') ?? false;
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
        return cached;
      }
    }

    const airlines = await this.mockProvider.getAirlines();
    await this.redis.set(this.CACHE_KEYS.AIRLINES, airlines);
    return airlines;
  }

  async getAircraft(forceRefresh = false): Promise<AircraftDto[]> {
    if (!forceRefresh) {
      const cached = await this.redis.get<AircraftDto[]>(this.CACHE_KEYS.AIRCRAFT);
      if (cached) {
        return cached;
      }
    }

    const aircraft = await this.mockProvider.getAircraft();
    await this.redis.set(this.CACHE_KEYS.AIRCRAFT, aircraft);
    return aircraft;
  }

  async searchFlights(params: FlightSearchParams): Promise<FlightSearchResultDto> {
    const cacheKey = `data:search:${params.origin}:${params.destination}:${params.departureDate}`;

    const cached = await this.redis.get<FlightSearchResultDto>(cacheKey);
    if (cached) {
      this.logger.log(`Search cache hit for ${params.origin}-${params.destination}`);
      return cached;
    }

    const result = await this.mockProvider.searchFlights(params);
    await this.redis.set(cacheKey, result, this.CACHE_TTL_LIVE);

    return result;
  }

  async checkHealth(): Promise<{ provider: string; available: boolean; latencyMs: number }[]> {
    const results: { provider: string; available: boolean; latencyMs: number }[] = [];

    const start = Date.now();
    const ourAvailable = await this.ourProvider.isAvailable();
    results.push({ provider: 'OurAirports', available: ourAvailable, latencyMs: Date.now() - start });

    results.push({ provider: 'MockProvider', available: true, latencyMs: 0 });

    return results;
  }

  async clearCache(): Promise<void> {
    const keys = await this.redis.keys('data:*');
    for (const key of keys) {
      await this.redis.del(key);
    }
    this.logger.log('Data cache cleared');
  }

  private printBanner(): void {
    console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║  DATA BOOTSTRAP                                                          ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Source: OurAirports (free CSV) + Mock Data                             ║
╚══════════════════════════════════════════════════════════════════════════════╝
    `);
  }
}
