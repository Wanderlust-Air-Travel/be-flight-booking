export interface AirportDto {
    iata_code: string;
    icao_code?: string | null;
    name: string;
    city: string;
    country: string;
    timezone: string;
    latitude?: number;
    longitude?: number;
}

export interface AirlineDto {
    iata_code: string;
    icao_code: string;
    name: string;
    callsign?: string;
    country?: string;
}

export interface AircraftDto {
    iata_code: string;
    name: string;
    category?: string;
}

export interface FlightSearchParams {
    origin: string;
    destination: string;
    departureDate: string;
    returnDate?: string;
    adults?: number;
    children?: number;
    infants?: number;
    cabinClass?: string;
    nonStop?: boolean;
    maxPrice?: number;
}

export interface FlightOfferDto {
    id: string;
    origin: string;
    destination: string;
    departureTime: string;
    arrivalTime: string;
    duration: string;
    airline: string;
    flightNumber: string;
    aircraft?: string;
    stops: number;
    price: {
        total: number;
        currency: string;
    };
    seatsAvailable?: number;
}

export interface FlightSearchResultDto {
    flights: FlightOfferDto[];
    currency: string;
    totalResults: number;
    provider: string;
}
