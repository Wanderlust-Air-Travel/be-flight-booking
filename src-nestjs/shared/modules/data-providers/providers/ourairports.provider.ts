import { Injectable, Logger } from '@nestjs/common';
import { DataProvider, type RateLimitInfo } from '../enums/data-provider.enum';
import type {
    AircraftDto,
    AirlineDto,
    AirportDto,
    FlightSearchParams,
    FlightSearchResultDto,
} from '../interfaces/data-provider.dto';
import type { FlightProvider, FlightStatusDto } from '../interfaces/flight-provider.interface';
import type { HttpClientService } from '../services/http-client.service';

@Injectable()
export class OurairportsProvider implements FlightProvider {
    readonly name = DataProvider.OURAIRPORTS;
    readonly priority = 1;
    private readonly logger = new Logger(OurairportsProvider.name);

    private readonly baseUrl = 'https://davidmegginson.github.io/ourairports-data';

    private cachedAirports: AirportDto[] | null = null;
    private cacheTimestamp: Date | null = null;
    private static readonly CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

    constructor(private readonly httpClient: HttpClientService) {
        this.logger.log('OurairportsProvider initialized (free CSV data - no API key required)');
    }

    get isEnabled(): boolean {
        return true;
    }

    async getAirports(): Promise<AirportDto[]> {
        if (this.cachedAirports && this.isCacheValid()) {
            this.logger.log(`Returning ${this.cachedAirports.length} airports from cache`);
            return this.cachedAirports;
        }

        this.logger.log('Fetching airports from OurAirports CSV...');

        try {
            const airportsCsv = await this.httpClient.get<string>(`${this.baseUrl}/airports.csv`, {
                timeout: 30000,
            });

            const airports = this.parseAirportsCsv(airportsCsv);
            this.cachedAirports = airports;
            this.cacheTimestamp = new Date();

            this.logger.log(`Parsed ${airports.length} airports from OurAirports`);
            return airports;
        } catch (error) {
            this.logger.error('Failed to fetch airports from OurAirports:', error);

            if (this.cachedAirports) {
                this.logger.warn('Returning stale cache due to fetch failure');
                return this.cachedAirports;
            }

            return this.getDefaultAirports();
        }
    }

    async getAirlines(): Promise<AirlineDto[]> {
        return [];
    }

    async getAircraft(): Promise<AircraftDto[]> {
        return [];
    }

    async searchFlights(_params: FlightSearchParams): Promise<FlightSearchResultDto> {
        this.logger.warn(
            'OurAirports provider does not support flight search. Use for reference data only.'
        );
        return {
            flights: [],
            currency: 'USD',
            totalResults: 0,
            provider: this.name,
        };
    }

    async getFlightStatus(_flightNumber: string, _date: string): Promise<FlightStatusDto | null> {
        return null;
    }

    getRateLimit(): RateLimitInfo {
        return {
            remaining: 999,
            limit: 999,
            resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        };
    }

    async isAvailable(): Promise<boolean> {
        try {
            await this.httpClient.get(`${this.baseUrl}/airports.csv`, { timeout: 10000 });
            return true;
        } catch {
            return false;
        }
    }

    private isCacheValid(): boolean {
        if (!this.cachedAirports || !this.cacheTimestamp) {
            return false;
        }
        return Date.now() - this.cacheTimestamp.getTime() < OurairportsProvider.CACHE_DURATION_MS;
    }

    private parseAirportsCsv(csv: string): AirportDto[] {
        const lines = csv.trim().split('\n');
        if (lines.length < 2) {
            return [];
        }

        const airports: AirportDto[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCsvLine(lines[i]);
            if (values.length < 12) continue;

            const iataCode = values[12]?.trim().replace(/"/g, '');
            if (!iataCode || iataCode.length !== 3 || !/^[A-Z]{3}$/.test(iataCode)) {
                continue;
            }

            const airportType = values[2]?.trim().replace(/"/g, '');
            if (airportType === 'closed' || airportType === 'heliport') {
                continue;
            }

            airports.push({
                iata_code: iataCode,
                icao_code: values[0]?.trim().replace(/"/g, '') || null,
                name: values[3]?.trim().replace(/"/g, '') || iataCode,
                city: values[10]?.trim().replace(/"/g, '') || 'Unknown',
                country: this.getCountryName(values[8]?.trim().replace(/"/g, '') || ''),
                timezone: 'UTC',
                latitude: Number.parseFloat(values[4]) || undefined,
                longitude: Number.parseFloat(values[5]) || undefined,
            });
        }

        return airports;
    }

    private parseCsvLine(line: string): string[] {
        const values: string[] = [];
        let current = '';
        let inQuotes = false;

        for (const char of line) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());

        return values;
    }

    private getCountryName(isoCode: string): string {
        const countryMap: Record<string, string> = {
            VN: 'Vietnam',
            US: 'United States',
            GB: 'United Kingdom',
            FR: 'France',
            DE: 'Germany',
            ES: 'Spain',
            IT: 'Italy',
            JP: 'Japan',
            CN: 'China',
            KR: 'South Korea',
            TH: 'Thailand',
            SG: 'Singapore',
            MY: 'Malaysia',
            ID: 'Indonesia',
            PH: 'Philippines',
            AU: 'Australia',
            NZ: 'New Zealand',
            IN: 'India',
            AE: 'United Arab Emirates',
            QA: 'Qatar',
            SA: 'Saudi Arabia',
            HK: 'Hong Kong',
            TW: 'Taiwan',
            MM: 'Myanmar',
            KH: 'Cambodia',
            LA: 'Laos',
        };
        return countryMap[isoCode] || isoCode;
    }

    private getDefaultAirports(): AirportDto[] {
        return [
            {
                iata_code: 'SGN',
                name: 'Tan Son Nhat International Airport',
                city: 'Ho Chi Minh City',
                country: 'Vietnam',
                timezone: 'Asia/Ho_Chi_Minh',
            },
            {
                iata_code: 'HAN',
                name: 'Noi Bai International Airport',
                city: 'Hanoi',
                country: 'Vietnam',
                timezone: 'Asia/Ho_Chi_Minh',
            },
            {
                iata_code: 'DAD',
                name: 'Da Nang International Airport',
                city: 'Da Nang',
                country: 'Vietnam',
                timezone: 'Asia/Ho_Chi_Minh',
            },
            {
                iata_code: 'NRT',
                name: 'Narita International Airport',
                city: 'Tokyo',
                country: 'Japan',
                timezone: 'Asia/Tokyo',
            },
            {
                iata_code: 'HND',
                name: 'Haneda Airport',
                city: 'Tokyo',
                country: 'Japan',
                timezone: 'Asia/Tokyo',
            },
            {
                iata_code: 'ICN',
                name: 'Incheon International Airport',
                city: 'Seoul',
                country: 'South Korea',
                timezone: 'Asia/Seoul',
            },
            {
                iata_code: 'SIN',
                name: 'Singapore Changi Airport',
                city: 'Singapore',
                country: 'Singapore',
                timezone: 'Asia/Singapore',
            },
            {
                iata_code: 'BKK',
                name: 'Suvarnabhumi Airport',
                city: 'Bangkok',
                country: 'Thailand',
                timezone: 'Asia/Bangkok',
            },
            {
                iata_code: 'KUL',
                name: 'Kuala Lumpur International Airport',
                city: 'Kuala Lumpur',
                country: 'Malaysia',
                timezone: 'Asia/Kuala_Lumpur',
            },
            {
                iata_code: 'LAX',
                name: 'Los Angeles International Airport',
                city: 'Los Angeles',
                country: 'United States',
                timezone: 'America/Los_Angeles',
            },
            {
                iata_code: 'JFK',
                name: 'John F. Kennedy International Airport',
                city: 'New York',
                country: 'United States',
                timezone: 'America/New_York',
            },
            {
                iata_code: 'LHR',
                name: 'London Heathrow Airport',
                city: 'London',
                country: 'United Kingdom',
                timezone: 'Europe/London',
            },
            {
                iata_code: 'CDG',
                name: 'Charles de Gaulle Airport',
                city: 'Paris',
                country: 'France',
                timezone: 'Europe/Paris',
            },
            {
                iata_code: 'DXB',
                name: 'Dubai International Airport',
                city: 'Dubai',
                country: 'United Arab Emirates',
                timezone: 'Asia/Dubai',
            },
        ];
    }
}
