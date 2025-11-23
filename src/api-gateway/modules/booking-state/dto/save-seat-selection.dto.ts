import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsUUIDv7 } from 'src/shared/validators/is-uuid-v7.validator';

export class SaveSeatSelectionDto {
	@ApiProperty({
		description: 'Flight instance ID',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@IsNotEmpty()
	@IsUUIDv7()
	flightInstanceId!: string;

	@ApiProperty({
		description: 'Flight seat ID (from search/seats API)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc72',
	})
	@IsNotEmpty()
	@IsUUIDv7()
	flightSeatId!: string;

	@ApiProperty({
		description: 'Seat number (e.g., "12A")',
		example: '12A',
	})
	@IsNotEmpty()
	@IsString()
	seatNumber!: string;
}

