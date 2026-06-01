import { ApiProperty } from '@nestjs/swagger';

class AirportResponseDto {
	@ApiProperty({ description: 'Airport ID', example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71' })
	airportId: string;

	@ApiProperty({ description: 'IATA code', example: 'SGN' })
	iataCode: string;

	@ApiProperty({ description: 'ICAO code', example: 'VVTS', required: false })
	icaoCode?: string | null;

	@ApiProperty({ description: 'Airport name', example: 'Tan Son Nhat International Airport' })
	name: string;

	@ApiProperty({ description: 'City', example: 'Ho Chi Minh City' })
	city: string;

	@ApiProperty({ description: 'Country', example: 'Vietnam' })
	country: string;

	@ApiProperty({ description: 'Timezone', example: 'Asia/Ho_Chi_Minh' })
	timezone: string;
}

class RouteResponseDto {
	@ApiProperty({ description: 'Route ID', example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71' })
	routeId: string;

	@ApiProperty({ description: 'Origin airport', type: AirportResponseDto })
	originAirport?: AirportResponseDto;

	@ApiProperty({ description: 'Destination airport', type: AirportResponseDto })
	destinationAirport?: AirportResponseDto;

	@ApiProperty({ description: 'Distance in kilometers', example: 1200, required: false })
	distanceKm?: number | null;

	@ApiProperty({ description: 'Is domestic route', example: true })
	isDomestic: boolean;
}

class AircraftTypeResponseDto {
	@ApiProperty({ description: 'Aircraft type ID', example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71' })
	aircraftTypeId: string;

	@ApiProperty({ description: 'Aircraft code', example: 'A321' })
	code: string;

	@ApiProperty({ description: 'Manufacturer', example: 'Airbus' })
	manufacturer: string;

	@ApiProperty({ description: 'Model', example: 'A321-200' })
	model: string;

	@ApiProperty({ description: 'Total seats', example: 180 })
	totalSeats: number;
}

export class FlightScheduleResponseDto {
	@ApiProperty({ description: 'Flight schedule ID', example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71' })
	flightScheduleId: string;

	@ApiProperty({ description: 'Flight number', example: 'QH101' })
	flightNumber: string;

	@ApiProperty({ description: 'Route ID', example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71' })
	routeId: string;

	@ApiProperty({ description: 'Route details', type: RouteResponseDto, required: false })
	route?: RouteResponseDto;

	@ApiProperty({ description: 'Aircraft type ID', example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71' })
	aircraftTypeId: string;

	@ApiProperty({ description: 'Aircraft type details', type: AircraftTypeResponseDto, required: false })
	aircraftType?: AircraftTypeResponseDto;

	@ApiProperty({ description: 'Departure time (HH:mm)', example: '08:00' })
	departureTime: string;

	@ApiProperty({ description: 'Arrival time (HH:mm)', example: '10:30' })
	arrivalTime: string;

	@ApiProperty({ description: 'Operating days (7 characters)', example: '1111111' })
	operatingDays: string;

	@ApiProperty({ description: 'Effective from date', example: '2025-01-01' })
	effectiveFrom: string | Date;

	@ApiProperty({ description: 'Effective to date', example: '2025-12-31' })
	effectiveTo: string | Date;

	@ApiProperty({ description: 'Status', example: 'active', enum: ['active', 'inactive', 'suspended'] })
	status: string;
}

