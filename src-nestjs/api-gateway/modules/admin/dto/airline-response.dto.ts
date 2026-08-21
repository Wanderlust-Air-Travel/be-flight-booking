import { ApiProperty } from '@nestjs/swagger';

export class AirlineResponseDto {
    @ApiProperty({
        description: 'Airline ID (UUID)',
        example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
    })
    airlineId: string;

    @ApiProperty({
        description: 'IATA airline code (2 letters)',
        example: 'VN',
    })
    iataCode: string;

    @ApiProperty({
        description: 'ICAO airline code (3 letters)',
        example: 'HVN',
        nullable: true,
    })
    icaoCode: string | null;

    @ApiProperty({
        description: 'Airline name',
        example: 'Vietnam Airlines',
    })
    name: string;

    @ApiProperty({
        description: 'Airline callsign',
        example: 'VIETNAM',
        nullable: true,
    })
    callsign: string | null;

    @ApiProperty({
        description: 'Country',
        example: 'Vietnam',
        nullable: true,
    })
    country: string | null;
}
