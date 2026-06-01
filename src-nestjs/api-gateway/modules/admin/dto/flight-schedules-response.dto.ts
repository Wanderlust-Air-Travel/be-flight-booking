import { ApiProperty } from '@nestjs/swagger';
import { FlightScheduleResponseDto } from './flight-schedule-response.dto';

export class FlightSchedulesResponseDto {
	@ApiProperty({ description: 'List of flight schedules', type: [FlightScheduleResponseDto] })
	data: FlightScheduleResponseDto[];

	@ApiProperty({ description: 'Current page number', example: 1 })
	currentPage: number;

	@ApiProperty({ description: 'Number of items per page', example: 20 })
	pageSize: number;

	@ApiProperty({ description: 'Total number of flight schedules', example: 100 })
	totalItems: number;

	@ApiProperty({ description: 'Total number of pages', example: 5 })
	totalPages: number;

	@ApiProperty({ description: 'Whether there is a next page', example: true })
	hasNextPage: boolean;

	@ApiProperty({ description: 'Whether there is a previous page', example: false })
	hasPreviousPage: boolean;
}

