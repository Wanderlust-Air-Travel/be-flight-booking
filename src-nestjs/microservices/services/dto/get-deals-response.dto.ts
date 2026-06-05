import { ApiProperty } from '@nestjs/swagger';

export class FlightDealDto {
    @ApiProperty({
        example: '/images/routes/019a8f4a-bb0e-7402-a0c4-27647b89dc71.jpg',
        description:
            'Path to deal image, format: /images/routes/{route_id}.jpg (route_id là UUID v7 - 36 ký tự)',
    })
    image: string;

    @ApiProperty({
        example: 'Tp. Hồ Chí Minh (SGN) đến Hà Nội (HAN)',
        description: 'Route description in Vietnamese',
    })
    title: string;

    @ApiProperty({
        example: '/service/019a8f4a-bb0e-7402-a0c4-27647b89dc71',
        description: 'Service link, format: /service/{route_id} (route_id là UUID v7 - 36 ký tự)',
    })
    link: string;

    @ApiProperty({ example: '02/03/2026', description: 'Departure date in DD/MM/YYYY format' })
    startDate: string;

    @ApiProperty({
        example: '09/03/2026',
        description: 'Return date in DD/MM/YYYY format (empty for one-way flights)',
    })
    endDate: string;

    @ApiProperty({
        example: 'one_way',
        description: 'Trip type: one_way or round_trip',
        enum: ['one_way', 'round_trip'],
    })
    tripType: string;

    @ApiProperty({ example: 'Dịch vụ bay thẳng', description: 'Service type' })
    service: string;

    @ApiProperty({ example: '962,000 VND', description: 'Formatted price' })
    price: string;
}

export class GetDealsResponseDto {
    @ApiProperty({ type: [FlightDealDto], description: 'List of flight deals' })
    deals: FlightDealDto[];
}
