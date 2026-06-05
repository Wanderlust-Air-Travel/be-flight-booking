import { ApiProperty } from '@nestjs/swagger';

export class MyJourneyItemDto {
    @ApiProperty({
        description: 'Journey ID (Booking ID)',
        example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
    })
    journeyId: string;

    @ApiProperty({ description: 'PNR code', example: 'ABC123' })
    pnrCode: string;

    @ApiProperty({ description: 'Origin airport IATA code', example: 'SGN' })
    originAirport: string;

    @ApiProperty({ description: 'Origin airport name', example: 'Sân bay Tân Sơn Nhất' })
    originAirportName: string;

    @ApiProperty({ description: 'Origin city', example: 'Hồ Chí Minh' })
    originCity: string;

    @ApiProperty({ description: 'Destination airport IATA code', example: 'HAN' })
    destinationAirport: string;

    @ApiProperty({ description: 'Destination airport name', example: 'Sân bay Nội Bài' })
    destinationAirportName: string;

    @ApiProperty({ description: 'Destination city', example: 'Hà Nội' })
    destinationCity: string;

    @ApiProperty({ description: 'Departure date and time', example: '2024-01-15T10:00:00' })
    departureDateTime: Date;

    @ApiProperty({ description: 'Arrival date and time', example: '2024-01-15T12:00:00' })
    arrivalDateTime: Date;

    @ApiProperty({ description: 'Flight number', example: 'QH101' })
    flightNumber: string;

    @ApiProperty({ description: 'Number of passengers', example: 2 })
    numberOfPassengers: number;

    @ApiProperty({ description: 'Is domestic flight', example: true })
    isDomestic: boolean;

    @ApiProperty({ description: 'Booking date', example: '2024-01-10T08:00:00' })
    bookingDate: Date;

    @ApiProperty({ description: 'Booking status', example: 'confirmed' })
    status: string;
}
