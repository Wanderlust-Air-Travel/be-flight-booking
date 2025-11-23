import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, Length, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { TripType } from 'src/shared/constants/enums';

// Export enum values for Swagger documentation
export const TripTypeEnum = TripType;

export class SearchFlightsDto {
	@ApiProperty({ description: 'Origin airport IATA code (e.g., HAN)', minLength: 3, maxLength: 3, example: 'HAN' })
	@IsString()
	@Length(3, 3)
	origin!: string;

	@ApiProperty({ description: 'Destination airport IATA code (e.g., SGN)', minLength: 3, maxLength: 3, example: 'SGN' })
	@IsString()
	@Length(3, 3)
	destination!: string;

	@ApiProperty({ description: 'Departure date in ISO format (YYYY-MM-DD)', example: '2025-11-17' })
	@IsDateString()
	departDate!: string;

	@ApiPropertyOptional({ 
		description: 'Return date for round trip in ISO format (YYYY-MM-DD). If provided, tripType will default to round_trip. If not provided or empty, tripType will default to one_way', 
		example: '2025-11-24' 
	})
	@IsOptional()
	@ValidateIf((o) => o.returnDate !== '' && o.returnDate !== null && o.returnDate !== undefined)
	@IsDateString()
	returnDate?: string;

	@ApiPropertyOptional({ 
		enum: TripType, 
		example: TripType.ONE_WAY,
		description: 'Type of trip: one_way or round_trip. If not provided, will default to one_way when returnDate is missing, or round_trip when returnDate is provided'
	})
	@IsOptional()
	@IsEnum(TripType)
	tripType?: TripType;

	@ApiProperty({ description: 'Number of adult passengers', minimum: 1, example: 1 })
	@Type(() => Number)
	@IsInt()
	@IsPositive()
	adults!: number;

	@ApiProperty({ description: 'Number of minor passengers', minimum: 0, example: 0 })
	@Type(() => Number)
	@IsInt()
	@Min(0)
	minors!: number;
}


