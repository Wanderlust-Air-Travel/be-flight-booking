import { ApiProperty } from '@nestjs/swagger';
import { BaggageAllowance } from 'src/api-gateway/data-access/entities/fare/baggage-allowance.entity';

export class BaggageAllowancesResponseDto {
    @ApiProperty({ description: 'List of baggage allowances', type: [BaggageAllowance] })
    data: BaggageAllowance[];

    @ApiProperty({ description: 'Current page number', example: 1 })
    currentPage: number;

    @ApiProperty({ description: 'Number of items per page', example: 20 })
    pageSize: number;

    @ApiProperty({ description: 'Total number of baggage allowances', example: 100 })
    totalItems: number;

    @ApiProperty({ description: 'Total number of pages', example: 5 })
    totalPages: number;

    @ApiProperty({ description: 'Whether there is a next page', example: true })
    hasNextPage: boolean;

    @ApiProperty({ description: 'Whether there is a previous page', example: false })
    hasPreviousPage: boolean;
}
