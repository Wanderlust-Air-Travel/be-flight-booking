import { ApiProperty } from '@nestjs/swagger';
import { FareDescriptionItemDto } from 'src/api-gateway/modules/search/dto/fare-option.dto';

export class BookingFareDetailsResponseDto {
	@ApiProperty({
		description: 'Booking ID',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	bookingId!: string;

	@ApiProperty({
		description: 'PNR code',
		example: 'ABC123',
	})
	pnrCode!: string;

	@ApiProperty({
		description: 'Fare class name',
		example: 'Economy Smart',
	})
	fareClassName!: string;

	@ApiProperty({
		description: 'List of fare descriptions',
		type: [FareDescriptionItemDto],
	})
	descriptions!: FareDescriptionItemDto[];

	@ApiProperty({
		description: 'Total price for one way',
		example: 1577000,
	})
	priceOneWay!: number;

	@ApiProperty({
		description: 'Total number of passengers',
		example: 1,
	})
	totalPassengers!: number;

	@ApiProperty({
		description: 'Total price',
		example: 1577000,
	})
	totalPrice!: number;
}

