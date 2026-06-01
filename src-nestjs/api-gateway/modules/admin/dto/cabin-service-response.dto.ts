import { ApiProperty } from '@nestjs/swagger';

export class CabinClassDto {
	@ApiProperty({ description: 'Cabin class code', example: 'Y' })
	cabinClassCode: string;

	@ApiProperty({ description: 'Cabin class name', example: 'Economy' })
	name: string;
}

export class FareClassDto {
	@ApiProperty({ description: 'Fare class code', example: 'YS' })
	fareClassCode: string;

	@ApiProperty({ description: 'Cabin class code', example: 'Y' })
	cabinClassCode: string;

	@ApiProperty({ description: 'Fare class description', example: 'Economy Smart', required: false })
	description?: string | null;
}

export class CabinServiceResponseDto {
	@ApiProperty({ description: 'Cabin service ID', example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71' })
	cabinServiceId: string;

	@ApiProperty({ description: 'Cabin class code (nullable if service is fare-class specific)', example: 'Y', required: false })
	cabinClassCode: string | null;

	@ApiProperty({ description: 'Cabin class object', type: CabinClassDto, required: false })
	cabinClass?: CabinClassDto | null;

	@ApiProperty({ description: 'Fare class code (nullable if service is cabin-class specific)', example: 'YS', required: false })
	fareClassCode: string | null;

	@ApiProperty({ description: 'Fare class object', type: FareClassDto, required: false })
	fareClass?: FareClassDto | null;

	@ApiProperty({ description: 'Service type/category', example: 'meal' })
	serviceType: string;

	@ApiProperty({ description: 'Service name/description', example: 'Hot Meal' })
	serviceName: string;

	@ApiProperty({ description: 'Detailed description of the service', example: 'Hot meal and beverage served during flight', required: false })
	description: string | null;

	@ApiProperty({ description: 'Whether this service is included (true) or available for purchase (false)', example: true })
	isIncluded: boolean;

	@ApiProperty({ description: 'Price if service is not included (in VND)', example: 200000, required: false })
	price: number | null;

	@ApiProperty({ description: 'Whether this service is currently available', example: true })
	isActive: boolean;

	@ApiProperty({ description: 'Display order for UI', example: 0 })
	displayOrder: number;

	@ApiProperty({ description: 'Icon or image URL for the service', example: 'https://example.com/icons/meal.png', required: false })
	iconUrl: string | null;

	@ApiProperty({ description: 'Created timestamp', example: '2025-01-20T10:15:00Z' })
	createdAt: Date;

	@ApiProperty({ description: 'Updated timestamp', example: '2025-01-20T10:15:00Z', required: false })
	updatedAt: Date | null;
}

