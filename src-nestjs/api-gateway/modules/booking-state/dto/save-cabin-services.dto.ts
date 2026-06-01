import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsArray, ValidateNested, IsUUID, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class SelectedCabinServiceDto {
	@ApiProperty({ description: 'Cabin service ID', example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71' })
	@IsNotEmpty()
	@IsUUID()
	cabinServiceId: string;

	@ApiProperty({ description: 'Service type', example: 'meal' })
	@IsNotEmpty()
	@IsString()
	serviceType: string;

	@ApiProperty({ description: 'Service name', example: 'Hot Meal' })
	@IsNotEmpty()
	@IsString()
	serviceName: string;

	@ApiProperty({ description: 'Price in VND (null if included)', example: 200000, required: false })
	@IsOptional()
	@IsNumber()
	price: number | null;

	@ApiProperty({ description: 'Whether service is included', example: false })
	@IsNotEmpty()
	@IsBoolean()
	isIncluded: boolean;
}

export class SaveCabinServicesDto {
	@ApiProperty({ description: 'Flight instance ID', example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71' })
	@IsNotEmpty()
	@IsString()
	flightInstanceId: string;

	@ApiProperty({ description: 'Array of selected cabin services', type: [SelectedCabinServiceDto] })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => SelectedCabinServiceDto)
	services: SelectedCabinServiceDto[];
}

