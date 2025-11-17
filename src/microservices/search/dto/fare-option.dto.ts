import { ApiProperty } from '@nestjs/swagger';

export class FareDescriptionItemDto {
	@ApiProperty({
		description: 'Description text',
		example: 'Hành lý xách tay: 7kg',
	})
	text!: string;

	@ApiProperty({
		description: 'Status (true = included/available, false = not included/not available)',
		example: true,
	})
	status!: boolean;
}

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
		description: 'Fare class display name for ticket type',
		example: 'Economy Saver Max',
	})
	typeTicket!: string;

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
		description: 'List of fare descriptions with status',
		type: [FareDescriptionItemDto],
	})
	desc!: FareDescriptionItemDto[];

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

