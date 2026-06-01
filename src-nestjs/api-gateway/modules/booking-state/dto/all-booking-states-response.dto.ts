import { ApiProperty } from '@nestjs/swagger';
import { BookingStateResponseDto } from './booking-state-response.dto';

export class AllBookingStatesResponseDto {
	@ApiProperty({
		description: 'Array of booking states, each with flightInstanceId',
		type: [BookingStateResponseDto],
	})
	states!: BookingStateResponseDto[];
}

