import { ApiProperty } from '@nestjs/swagger';
import { MyJourneyItemDto } from './my-journey-item.dto';

export class MyJourneyResponseDto {
	@ApiProperty({ description: 'List of journeys', type: [MyJourneyItemDto] })
	journeys: MyJourneyItemDto[];

	@ApiProperty({ description: 'Total number of journeys', example: 15 })
	totalJourneys: number;
}

