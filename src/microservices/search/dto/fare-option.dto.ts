import { ApiProperty } from '@nestjs/swagger';

export class FareOptionDto {
	@ApiProperty({
		description: 'Fare class code (e.g., Y, M, B)',
		example: 'Y',
	})
	fareClassCode!: string;

	@ApiProperty({
		description: 'Fare class name (e.g., Economy Saver Max, Economy Smart)',
		example: 'Economy Saver Max',
	})
	name!: string;

	@ApiProperty({
		description: 'Price in VND',
		example: 1448000,
	})
	price!: number;

	@ApiProperty({
		description: 'Number of available seats for this fare class',
		example: 5,
	})
	availableSeats!: number;

	@ApiProperty({
		description: 'Fare class description',
		example: 'Basic economy fare with limited flexibility',
		nullable: true,
	})
	description?: string | null;

	@ApiProperty({
		description: 'Change rule description',
		nullable: true,
	})
	changeRule?: string | null;

	@ApiProperty({
		description: 'Refund rule description',
		nullable: true,
	})
	refundRule?: string | null;
}

