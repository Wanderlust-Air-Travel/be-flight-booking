import { Injectable, Logger } from '@nestjs/common';
import type {
    AircraftDto,
    AirlineDto,
    AirportDto,
    FlightOfferDto,
    FlightSearchParams,
    FlightSearchResultDto,
} from '../interfaces/data-provider.dto';

@Injectable()
export class MockProvider {
    readonly name = 'mock';
    private readonly logger = new Logger(MockProvider.name);

    constructor() {
        this.logger.log('MockProvider active - demo data only');
    }

    get isEnabled(): boolean {
        return true;
    }

    async getAirports(): Promise<AirportDto[]> {
        return this.getMockAirports();
    }

    async getAirlines(): Promise<AirlineDto[]> {
        return [
            {
                iata_code: 'VN',
                icao_code: 'HVN',
                name: 'Vietnam Airlines',
                callsign: 'VIETNAM AIR',
                country: 'Vietnam',
            },
            {
                iata_code: 'VJ',
                icao_code: 'VJC',
                name: 'VietJet Air',
                callsign: 'VIETJET',
                country: 'Vietnam',
            },
            {
                iata_code: 'BL',
                icao_code: 'AV',
                name: 'Bamboo Airways',
                callsign: 'BAMBOO',
                country: 'Vietnam',
            },
            {
                iata_code: 'AA',
                icao_code: 'AAL',
                name: 'American Airlines',
                callsign: 'AMERICAN',
                country: 'United States',
            },
            {
                iata_code: 'BA',
                icao_code: 'BAW',
                name: 'British Airways',
                callsign: 'SPEEDBIRD',
                country: 'United Kingdom',
            },
            {
                iata_code: 'AF',
                icao_code: 'AFR',
                name: 'Air France',
                callsign: 'AIRFRANS',
                country: 'France',
            },
            {
                iata_code: 'LH',
                icao_code: 'DLH',
                name: 'Lufthansa',
                callsign: 'LUFTHANSA',
                country: 'Germany',
            },
            {
                iata_code: 'EK',
                icao_code: 'UAE',
                name: 'Emirates',
                callsign: 'EMIRATES',
                country: 'UAE',
            },
            {
                iata_code: 'SQ',
                icao_code: 'SIA',
                name: 'Singapore Airlines',
                callsign: 'SINGAPORE',
                country: 'Singapore',
            },
            {
                iata_code: 'NH',
                icao_code: 'ANA',
                name: 'All Nippon Airways',
                callsign: 'ALL NIPPON',
                country: 'Japan',
            },
            {
                iata_code: 'QF',
                icao_code: 'QFA',
                name: 'Qantas',
                callsign: 'QANTAS',
                country: 'Australia',
            },
            {
                iata_code: 'KE',
                icao_code: 'KOR',
                name: 'Korean Air',
                callsign: 'KOREAN AIR',
                country: 'South Korea',
            },
        ];
    }

    async getAircraft(): Promise<AircraftDto[]> {
        return [
            { iata_code: '320', name: 'Airbus A320', category: 'narrowbody' },
            { iata_code: '321', name: 'Airbus A321', category: 'narrowbody' },
            { iata_code: '319', name: 'Airbus A319', category: 'narrowbody' },
            { iata_code: '332', name: 'Airbus A330-200', category: 'widebody' },
            { iata_code: '359', name: 'Airbus A350-900', category: 'widebody' },
            { iata_code: '789', name: 'Boeing 787-9 Dreamliner', category: 'widebody' },
            { iata_code: '77W', name: 'Boeing 777-300ER', category: 'widebody' },
            { iata_code: '738', name: 'Boeing 737-800', category: 'narrowbody' },
        ];
    }

    async searchFlights(params: FlightSearchParams): Promise<FlightSearchResultDto> {
        const baseDate = params.departureDate || new Date().toISOString().slice(0, 10);
        const passengerCount = (params.adults || 1) + (params.children || 0);
        const cabinMultiplier =
            params.cabinClass === 'business' ? 3 : params.cabinClass === 'first' ? 5 : 1;

        const flights: FlightOfferDto[] = [];
        for (let i = 0; i < 5; i++) {
            const depHour = 6 + i * 3;
            const depMin = [0, 15, 30, 45][i % 4];
            const durationHours = 1 + (i % 4);
            const durationMin = 15 + (i % 3) * 10;

            const depTime = `${baseDate}T${String(depHour).padStart(2, '0')}:${String(depMin).padStart(2, '0')}:00`;
            const depDate = new Date(depTime);
            const arrDate = new Date(
                depDate.getTime() + (durationHours * 60 + durationMin) * 60 * 1000
            );

            const basePrice = 500000 + i * 350000;
            const airlines = await this.getAirlines();
            const airline = airlines[i % airlines.length];

            flights.push({
                id: `${airline.iata_code}${100 + i}_${baseDate}`,
                origin: params.origin,
                destination: params.destination,
                departureTime: depTime,
                arrivalTime: arrDate.toISOString(),
                duration: `PT${durationHours}H${durationMin}M`,
                airline: airline.iata_code,
                flightNumber: `${airline.iata_code}${100 + i}`,
                aircraft: ['320', '321', '738', '789'][i % 4],
                stops: 0,
                price: {
                    total: basePrice * cabinMultiplier * passengerCount,
                    currency: 'VND',
                },
                seatsAvailable: 20 + i * 15,
            });
        }

        return {
            flights,
            currency: 'VND',
            totalResults: flights.length,
            provider: this.name,
        };
    }

    private getMockAirports(): AirportDto[] {
        return [
            {
                iata_code: 'SGN',
                name: 'Tan Son Nhat International Airport',
                city: 'Ho Chi Minh City',
                country: 'Vietnam',
                timezone: 'Asia/Ho_Chi_Minh',
                latitude: 10.8188,
                longitude: 106.652,
            },
            {
                iata_code: 'HAN',
                name: 'Noi Bai International Airport',
                city: 'Hanoi',
                country: 'Vietnam',
                timezone: 'Asia/Ho_Chi_Minh',
                latitude: 21.2212,
                longitude: 105.8069,
            },
            {
                iata_code: 'DAD',
                name: 'Da Nang International Airport',
                city: 'Da Nang',
                country: 'Vietnam',
                timezone: 'Asia/Ho_Chi_Minh',
                latitude: 16.0439,
                longitude: 108.1994,
            },
            {
                iata_code: 'NRT',
                name: 'Narita International Airport',
                city: 'Tokyo',
                country: 'Japan',
                timezone: 'Asia/Tokyo',
                latitude: 35.7647,
                longitude: 140.3864,
            },
            {
                iata_code: 'HND',
                name: 'Haneda Airport',
                city: 'Tokyo',
                country: 'Japan',
                timezone: 'Asia/Tokyo',
                latitude: 35.5494,
                longitude: 139.7798,
            },
            {
                iata_code: 'ICN',
                name: 'Incheon International Airport',
                city: 'Seoul',
                country: 'South Korea',
                timezone: 'Asia/Seoul',
                latitude: 37.4602,
                longitude: 126.4407,
            },
            {
                iata_code: 'SIN',
                name: 'Singapore Changi Airport',
                city: 'Singapore',
                country: 'Singapore',
                timezone: 'Asia/Singapore',
                latitude: 1.3644,
                longitude: 103.9915,
            },
            {
                iata_code: 'BKK',
                name: 'Suvarnabhumi Airport',
                city: 'Bangkok',
                country: 'Thailand',
                timezone: 'Asia/Bangkok',
                latitude: 13.69,
                longitude: 100.7501,
            },
            {
                iata_code: 'KUL',
                name: 'Kuala Lumpur International Airport',
                city: 'Kuala Lumpur',
                country: 'Malaysia',
                timezone: 'Asia/Kuala_Lumpur',
                latitude: 2.7456,
                longitude: 101.7099,
            },
            {
                iata_code: 'CGK',
                name: 'Soekarno-Hatta International Airport',
                city: 'Jakarta',
                country: 'Indonesia',
                timezone: 'Asia/Jakarta',
                latitude: -6.1275,
                longitude: 106.6537,
            },
            {
                iata_code: 'SYD',
                name: 'Sydney Airport',
                city: 'Sydney',
                country: 'Australia',
                timezone: 'Australia/Sydney',
                latitude: -33.9399,
                longitude: 151.1753,
            },
            {
                iata_code: 'LAX',
                name: 'Los Angeles International Airport',
                city: 'Los Angeles',
                country: 'United States',
                timezone: 'America/Los_Angeles',
                latitude: 33.9416,
                longitude: -118.4085,
            },
            {
                iata_code: 'JFK',
                name: 'John F. Kennedy International Airport',
                city: 'New York',
                country: 'United States',
                timezone: 'America/New_York',
                latitude: 40.6413,
                longitude: -73.7781,
            },
            {
                iata_code: 'LHR',
                name: 'London Heathrow Airport',
                city: 'London',
                country: 'United Kingdom',
                timezone: 'Europe/London',
                latitude: 51.47,
                longitude: -0.4543,
            },
            {
                iata_code: 'CDG',
                name: 'Charles de Gaulle Airport',
                city: 'Paris',
                country: 'France',
                timezone: 'Europe/Paris',
                latitude: 49.0097,
                longitude: 2.5479,
            },
            {
                iata_code: 'DXB',
                name: 'Dubai International Airport',
                city: 'Dubai',
                country: 'UAE',
                timezone: 'Asia/Dubai',
                latitude: 25.2532,
                longitude: 55.3657,
            },
        ];
    }
}
