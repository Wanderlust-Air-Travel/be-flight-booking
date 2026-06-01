import { ApiProperty } from '@nestjs/swagger';

export class CheckInBookingResponseDto {
	@ApiProperty({
		description: 'Booking ID',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	bookingId: string;

	@ApiProperty({
		description: 'PNR code',
		example: 'ABC123',
	})
	pnrCode: string;

	@ApiProperty({
		description: 'Number of tickets created',
		example: 2,
	})
	ticketCount: number;

	@ApiProperty({
		description: 'Success message',
		example: 'Check-in completed successfully. Tickets have been issued and sent to your email.',
	})
	message: string;

	@ApiProperty({
		description: 'Indicates if booking was already checked in (idempotent operation)',
		example: false,
		required: false,
	})
	alreadyCheckedIn?: boolean;
}

