import { ApiProperty } from '@nestjs/swagger';
import { CabinType } from 'src/shared/constants/enums';
import { SeatDto } from './seat.dto';

export class SeatMapGroupDto {
	@ApiProperty({
		description: 'Cabin group ID (business or economy)',
		example: 'business',
		enum: ['business', 'economy'],
	})
	id!: 'business' | 'economy';

	@ApiProperty({
		description: 'List of seats in this cabin group',
		type: [SeatDto],
	})
	list!: SeatDto[];
}

export class SeatMapResponseDto {
	@ApiProperty({
		description: 'Flight instance ID',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	flightInstanceId!: string;

	@ApiProperty({
		description: 'Flight number',
		example: 'VN123',
	})
	flightNumber!: string;

	@ApiProperty({
		enum: CabinType,
		description: 'Cabin type requested',
		example: CabinType.ECONOMY,
	})
	cabinType!: CabinType;

	@ApiProperty({
		description: 'Seat map grouped by cabin class',
		type: [SeatMapGroupDto],
	})
	seats!: SeatMapGroupDto[];
}

