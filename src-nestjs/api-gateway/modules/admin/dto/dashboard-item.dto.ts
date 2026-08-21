import { ApiProperty } from '@nestjs/swagger';
import type { SystemRole } from 'src/shared/constants/roles';

export class DashboardItemDto {
    @ApiProperty({
        description: 'Unique identifier for the dashboard item',
        example: 'route-fare-prices',
    })
    id: string;

    @ApiProperty({
        description: 'Title of the dashboard item',
        example: 'Quản lý giá vé theo route',
    })
    title: string;

    @ApiProperty({
        description: 'Description of the dashboard item',
        example: 'Quản lý giá vé và giá cả',
    })
    description: string;

    @ApiProperty({
        description: 'URL path to the dashboard item',
        example: '/admin/route-fare-prices',
    })
    href: string;

    @ApiProperty({
        description: 'Icon name for the dashboard item',
        example: 'TrendingUp',
    })
    icon: string;

    @ApiProperty({
        description: 'Color class for the icon',
        example: 'text-green-600',
    })
    color: string;

    @ApiProperty({
        description: 'Background color class',
        example: 'bg-green-50',
    })
    bgColor: string;

    // Internal field, not exposed in API response
    requiredRoles?: SystemRole[];
}

export class DashboardResponseDto {
    @ApiProperty({
        description: 'List of dashboard items the user has access to',
        type: [DashboardItemDto],
    })
    items: DashboardItemDto[];

    @ApiProperty({
        description: 'List of menu items the user has access to',
        type: [DashboardItemDto],
    })
    menuItems: DashboardItemDto[];
}
