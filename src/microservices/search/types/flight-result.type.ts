/**
 * Internal types for Search Service
 * These types are used for internal data processing before mapping to DTOs
 */

export interface FlightResult {
	flightInstanceId: string;
	flightNumber: string;
	departureLocal: Date;
	arrivalLocal: Date;
	availableSeats: number;
	origin: { iata: string; name: string; city: string };
	destination: { iata: string; name: string; city: string };
}

