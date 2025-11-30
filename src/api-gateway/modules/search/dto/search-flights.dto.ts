import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, Length, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { TripType } from 'src/shared/constants/enums';
import { SEARCH_MESSAGES } from 'src/shared/constants/messages';

// Export enum values for Swagger documentation
export const TripTypeEnum = TripType;

export class SearchFlightsDto {
	@ApiProperty({ description: 'Origin airport IATA code (e.g., HAN)', minLength: 3, maxLength: 3, example: 'HAN' })
	@IsString({ message: SEARCH_MESSAGES.VALIDATION.ORIGIN_REQUIRED })
	@IsNotEmpty({ message: SEARCH_MESSAGES.VALIDATION.ORIGIN_REQUIRED })
	@Length(3, 3, { message: SEARCH_MESSAGES.VALIDATION.ORIGIN_INVALID })
	origin!: string;

	@ApiProperty({ description: 'Destination airport IATA code (e.g., SGN)', minLength: 3, maxLength: 3, example: 'SGN' })
	@IsString({ message: SEARCH_MESSAGES.VALIDATION.DESTINATION_REQUIRED })
	@IsNotEmpty({ message: SEARCH_MESSAGES.VALIDATION.DESTINATION_REQUIRED })
	@Length(3, 3, { message: SEARCH_MESSAGES.VALIDATION.DESTINATION_INVALID })
	destination!: string;

	@ApiProperty({ description: 'Departure date in ISO format (YYYY-MM-DD)', example: '2025-11-17' })
	@IsDateString({}, { message: SEARCH_MESSAGES.VALIDATION.DEPART_DATE_INVALID })
	@IsNotEmpty({ message: SEARCH_MESSAGES.VALIDATION.DEPART_DATE_REQUIRED })
	departDate!: string;

	@ApiPropertyOptional({ 
		description: 'Return date for round trip in ISO format (YYYY-MM-DD). If provided, tripType will default to round_trip. If not provided or empty, tripType will default to one_way', 
		example: '2025-11-24' 
	})
	@IsOptional()
	@ValidateIf((o) => o.returnDate !== '' && o.returnDate !== null && o.returnDate !== undefined)
	@IsDateString({}, { message: SEARCH_MESSAGES.VALIDATION.RETURN_DATE_INVALID })
	returnDate?: string;

	@ApiPropertyOptional({ 
		enum: TripType, 
		example: TripType.ONE_WAY,
		description: 'Type of trip: one_way or round_trip. If not provided, will default to one_way when returnDate is missing, or round_trip when returnDate is provided'
	})
	@IsOptional()
	@IsEnum(TripType, { message: SEARCH_MESSAGES.VALIDATION.TRIP_TYPE_INVALID })
	tripType?: TripType;

	@ApiProperty({ description: 'Number of adult passengers', minimum: 1, example: 1 })
	@Type(() => Number)
	@IsInt({ message: SEARCH_MESSAGES.VALIDATION.ADULTS_REQUIRED })
	@IsPositive({ message: SEARCH_MESSAGES.VALIDATION.ADULTS_MIN })
	@IsNotEmpty({ message: SEARCH_MESSAGES.VALIDATION.ADULTS_REQUIRED })
	adults!: number;

	@ApiProperty({ description: 'Number of minor passengers', minimum: 0, example: 0 })
	@Type(() => Number)
	@IsInt({ message: SEARCH_MESSAGES.VALIDATION.MINORS_INVALID })
	@Min(0, { message: SEARCH_MESSAGES.VALIDATION.MINORS_INVALID })
	minors!: number;
}


