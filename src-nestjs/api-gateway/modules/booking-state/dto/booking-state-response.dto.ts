import { ApiProperty } from '@nestjs/swagger';

export class CabinSelectionDto {
	@ApiProperty()
	flightInstanceId!: string;

	@ApiProperty({ enum: ['economy', 'business'] })
	cabinType!: 'economy' | 'business';

	@ApiProperty()
	fareClassCode!: string;
}

export class SeatSelectionDto {
	@ApiProperty()
	flightInstanceId!: string;

	@ApiProperty()
	flightSeatId!: string;

	@ApiProperty()
	seatNumber!: string;
}

export class BookingStateResponseDto {
	@ApiProperty()
	flightInstanceId!: string;

	@ApiProperty({ type: CabinSelectionDto, required: false })
	cabin?: CabinSelectionDto;

	@ApiProperty({ type: SeatSelectionDto, required: false })
	seat?: SeatSelectionDto;

	@ApiProperty()
	updatedAt!: Date;
}

