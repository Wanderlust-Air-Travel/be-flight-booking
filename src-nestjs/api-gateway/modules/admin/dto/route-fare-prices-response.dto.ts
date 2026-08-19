import { ApiProperty } from '@nestjs/swagger';
import { RouteFarePrice } from 'src/api-gateway/data-access/entities/fare/route-fare-price.entity';

export class RouteFarePricesResponseDto {
    @ApiProperty({ description: 'List of route fare prices', type: [RouteFarePrice] })
    data: RouteFarePrice[];

    @ApiProperty({ description: 'Current page number', example: 1 })
    currentPage: number;

    @ApiProperty({ description: 'Number of items per page', example: 20 })
    pageSize: number;

    @ApiProperty({ description: 'Total number of route fare prices', example: 3800 })
    totalItems: number;

    @ApiProperty({ description: 'Total number of pages', example: 190 })
    totalPages: number;

    @ApiProperty({ description: 'Whether there is a next page', example: true })
    hasNextPage: boolean;

    @ApiProperty({ description: 'Whether there is a previous page', example: false })
    hasPreviousPage: boolean;
}
