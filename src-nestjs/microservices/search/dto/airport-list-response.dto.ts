import { ApiProperty } from '@nestjs/swagger';

export class AirportListItemDto {
    @ApiProperty({ description: 'Airport IATA code', example: 'HAN' })
    iata!: string;

    @ApiProperty({ description: 'Airport name', example: 'Noi Bai International Airport' })
    name!: string;

    @ApiProperty({ description: 'City name', example: 'Hanoi' })
    city!: string;

    @ApiProperty({
        description: 'Slug value for frontend (city name in lowercase with hyphens)',
        example: 'ha-noi',
    })
    value!: string;
}

export class AirportListResponseDto {
    @ApiProperty({
        type: [AirportListItemDto],
        description: 'List of all available airports',
    })
    airports!: AirportListItemDto[];
}
