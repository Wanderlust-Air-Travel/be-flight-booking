/**
 * Interface for flight search result
 * Used for internal data processing before mapping to DTOs
 */
export interface CabinTypeInfo {
	cabinType: string; // 'economy' | 'business' | 'first'
	availableSeats: number;
}

export interface FlightResult {
	flightInstanceId: string;
	flightNumber: string;
	departureLocal: Date;
	arrivalLocal: Date;
	availableSeats: number;
	origin: { iata: string; name: string; city: string };
	destination: { iata: string; name: string; city: string };
	cabinTypes: CabinTypeInfo[]; // Available cabin types with seat counts
}

