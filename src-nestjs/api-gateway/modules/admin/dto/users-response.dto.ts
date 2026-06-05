import { ApiProperty } from '@nestjs/swagger';
import { User } from 'src/shared/entities/user/user.entity';

export class UsersResponseDto {
    @ApiProperty({ description: 'List of users', type: [User] })
    data: User[];

    @ApiProperty({ description: 'Current page number', example: 1 })
    currentPage: number;

    @ApiProperty({ description: 'Number of items per page', example: 20 })
    pageSize: number;

    @ApiProperty({ description: 'Total number of users', example: 100 })
    totalItems: number;

    @ApiProperty({ description: 'Total number of pages', example: 5 })
    totalPages: number;

    @ApiProperty({ description: 'Whether there is a next page', example: true })
    hasNextPage: boolean;

    @ApiProperty({ description: 'Whether there is a previous page', example: false })
    hasPreviousPage: boolean;
}
