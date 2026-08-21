import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class GetRouteFarePricesDto {
    @ApiProperty({
        description: 'Page number (1-based)',
        example: 1,
        required: false,
        default: 1,
        minimum: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiProperty({
        description: 'Number of items per page. Allowed values: 20, 50, 100, 200',
        example: 20,
        required: false,
        default: 20,
        enum: [20, 50, 100, 200],
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsIn([20, 50, 100, 200], {
        message: 'limit must be one of: 20, 50, 100, 200',
    })
    limit?: number = 20;

    @ApiProperty({
        description:
            'Search query to filter by route, fare class, city (origin/destination), airport code, etc.',
        example: 'Hà Nội',
        required: false,
    })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiProperty({
        description: 'Filter by active status',
        example: 'all',
        enum: ['all', 'active', 'inactive'],
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsIn(['all', 'active', 'inactive'], {
        message: 'filterActive must be one of: all, active, inactive',
    })
    filterActive?: 'all' | 'active' | 'inactive' = 'all';
}
