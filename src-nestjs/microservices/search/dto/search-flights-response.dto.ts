import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TripType } from 'src/shared/constants/enums';

export class AirportInfoDto {
    @ApiProperty({ description: 'Airport IATA code', example: 'HAN' })
    iata!: string;

    @ApiProperty({ description: 'Airport name', example: 'Noi Bai International Airport' })
    name!: string;

    @ApiProperty({ description: 'City name', example: 'Hanoi' })
    city!: string;
}

export class CabinTypeInfoDto {
    @ApiProperty({
        description: 'Cabin type',
        example: 'economy',
        enum: ['economy', 'business', 'first'],
    })
    cabinType!: string;

    @ApiProperty({
        description: 'Number of available seats for this cabin type',
        example: 135,
        minimum: 0,
    })
    availableSeats!: number;
}

export class FlightResultDto {
    @ApiProperty({
        description: 'Flight instance ID (empty string if from schedule)',
        example: 'a3f1f8e6-5a6b-4b2d-9f1a-2c3d4e5f6a7b',
    })
    flightInstanceId!: string;

    @ApiProperty({ description: 'Flight number', example: 'BB0100' })
    flightNumber!: string;

    @ApiProperty({
        description: 'Departure datetime in local timezone',
        example: '2025-11-17T08:00:00',
    })
    departureLocal!: Date;

    @ApiProperty({
        description: 'Arrival datetime in local timezone',
        example: '2025-11-17T10:10:00',
    })
    arrivalLocal!: Date;

    @ApiProperty({
        description: 'Total number of available seats (across all cabin types)',
        example: 180,
        minimum: 0,
    })
    availableSeats!: number;

    @ApiProperty({ type: AirportInfoDto, description: 'Origin airport information' })
    origin!: AirportInfoDto;

    @ApiProperty({ type: AirportInfoDto, description: 'Destination airport information' })
    destination!: AirportInfoDto;

    @ApiProperty({
        type: [CabinTypeInfoDto],
        description: 'Available cabin types with seat counts for this flight instance',
        example: [
            { cabinType: 'economy', availableSeats: 135 },
            { cabinType: 'business', availableSeats: 20 },
        ],
    })
    cabinTypes!: CabinTypeInfoDto[];
}

export class SearchFlightsResponseDto {
    @ApiProperty({
        enum: TripType,
        description: 'Type of trip',
        example: TripType.ONE_WAY,
    })
    tripType!: TripType;

    @ApiProperty({
        type: [FlightResultDto],
        description: 'Outbound flights (departure)',
    })
    outbound!: FlightResultDto[];

    @ApiPropertyOptional({
        type: [FlightResultDto],
        description: 'Inbound flights (return) - only for round trip',
    })
    inbound?: FlightResultDto[];

    @ApiProperty({
        description: 'Total number of passengers (adults + minors)',
        example: 1,
        minimum: 1,
    })
    totalPassengers!: number;
}
