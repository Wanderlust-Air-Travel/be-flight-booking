import { ApiProperty } from '@nestjs/swagger';
import { MyTicketItemDto } from './my-ticket-item.dto';

export class MyTicketsResponseDto {
    @ApiProperty({ description: 'List of tickets', type: [MyTicketItemDto] })
    tickets: MyTicketItemDto[];

    @ApiProperty({ description: 'Current page number', example: 1 })
    currentPage: number;

    @ApiProperty({ description: 'Number of items per page', example: 10 })
    pageSize: number;

    @ApiProperty({ description: 'Total number of tickets', example: 25 })
    totalItems: number;

    @ApiProperty({ description: 'Total number of pages', example: 3 })
    totalPages: number;

    @ApiProperty({ description: 'Whether there is a next page', example: true })
    hasNextPage: boolean;

    @ApiProperty({ description: 'Whether there is a previous page', example: false })
    hasPreviousPage: boolean;
}
