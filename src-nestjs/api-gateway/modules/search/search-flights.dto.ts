import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsDateString,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsPositive,
    IsString,
    Length,
    Min,
    ValidateIf,
} from 'class-validator';
import { TripType } from 'src/shared/constants/enums';

// Export enum values for Swagger documentation
export const TripTypeEnum = TripType;

export class SearchFlightsDto {
    @ApiProperty({
        description: 'Origin airport IATA code (e.g., HAN)',
        minLength: 3,
        maxLength: 3,
        example: 'HAN',
    })
    @IsString()
    @Length(3, 3)
    origin!: string;

    @ApiProperty({
        description: 'Destination airport IATA code (e.g., SGN)',
        minLength: 3,
        maxLength: 3,
        example: 'SGN',
    })
    @IsString()
    @Length(3, 3)
    destination!: string;

    @ApiProperty({
        description: 'Departure date in ISO format (YYYY-MM-DD)',
        example: '2025-11-17',
    })
    @IsDateString()
    departDate!: string;

    @ApiPropertyOptional({
        description:
            'Return date for round trip in ISO format (YYYY-MM-DD). Required if tripType is round_trip',
        example: '2025-11-24',
    })
    @ValidateIf((o) => o.tripType === TripType.ROUND_TRIP)
    @IsNotEmpty({ message: 'returnDate is required when tripType is round_trip' })
    @IsDateString()
    returnDate?: string;

    @ApiProperty({ enum: TripType, example: TripType.ONE_WAY })
    @IsEnum(TripType)
    tripType!: TripType;

    @ApiProperty({ description: 'Number of adult passengers', minimum: 1, example: 1 })
    @IsInt()
    @IsPositive()
    adults!: number;

    @ApiProperty({ description: 'Number of minor passengers', minimum: 0, example: 0 })
    @IsInt()
    @Min(0)
    minors!: number;
}
