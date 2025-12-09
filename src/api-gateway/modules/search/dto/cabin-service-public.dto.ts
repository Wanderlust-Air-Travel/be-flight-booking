import { ApiProperty } from '@nestjs/swagger';

export class CabinServicePublicDto {
	@ApiProperty({ description: 'Cabin service ID', example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71' })
	cabinServiceId: string;

	@ApiProperty({ description: 'Service type/category', example: 'meal' })
	serviceType: string;

	@ApiProperty({ description: 'Service name/description', example: 'Hot Meal' })
	serviceName: string;

	@ApiProperty({ description: 'Detailed description', example: 'Hot meal and beverage served during flight', required: false })
	description: string | null;

	@ApiProperty({ description: 'Whether this service is included (true) or available for purchase (false)', example: true })
	isIncluded: boolean;

	@ApiProperty({ description: 'Price if service is not included (in VND)', example: 200000, required: false })
	price: number | null;

	@ApiProperty({ description: 'Display order for UI', example: 0 })
	displayOrder: number;

	@ApiProperty({ description: 'Icon or image URL', example: 'https://example.com/icons/meal.png', required: false })
	iconUrl: string | null;
}

export class CabinServicesResponseDto {
	@ApiProperty({ description: 'List of cabin services', type: [CabinServicePublicDto] })
	services: CabinServicePublicDto[];

	@ApiProperty({ description: 'Total price of selected services (only for services that are not included)', example: 0 })
	totalPrice: number;
}

