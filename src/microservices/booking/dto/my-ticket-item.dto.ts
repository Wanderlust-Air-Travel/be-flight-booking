import { ApiProperty } from '@nestjs/swagger';

export class MyTicketItemDto {
	@ApiProperty({ description: 'Ticket ID', example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71' })
	ticketId: string;

	@ApiProperty({ description: 'Ticket number', example: 'TK1234567890' })
	ticketNumber: string;

	@ApiProperty({ description: 'Booking ID', example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71' })
	bookingId: string;

	@ApiProperty({ description: 'PNR code', example: 'ABC123' })
	pnrCode: string;

	@ApiProperty({ description: 'Passenger full name', example: 'Nguyễn Văn A' })
	passengerName: string;

	@ApiProperty({ description: 'Flight number', example: 'QH101' })
	flightNumber: string;

	@ApiProperty({ description: 'Origin airport IATA code', example: 'SGN' })
	originAirport: string;

	@ApiProperty({ description: 'Origin airport name', example: 'Sân bay Tân Sơn Nhất' })
	originAirportName: string;

	@ApiProperty({ description: 'Origin city', example: 'Hồ Chí Minh' })
	originCity: string;

	@ApiProperty({ description: 'Destination airport IATA code', example: 'HAN' })
	destinationAirport: string;

	@ApiProperty({ description: 'Destination airport name', example: 'Sân bay Nội Bài' })
	destinationAirportName: string;

	@ApiProperty({ description: 'Destination city', example: 'Hà Nội' })
	destinationCity: string;

	@ApiProperty({ description: 'Departure date and time', example: '2024-01-15T10:00:00' })
	departureDateTime: Date;

	@ApiProperty({ description: 'Arrival date and time', example: '2024-01-15T12:00:00' })
	arrivalDateTime: Date;

	@ApiProperty({ description: 'Fare class code', example: 'YSM' })
	fareClassCode: string;

	@ApiProperty({ description: 'Fare class name', example: 'Economy Saver Max' })
	fareClassName: string;

	@ApiProperty({ description: 'Cabin class', example: 'economy' })
	cabinClass: string;

	@ApiProperty({ description: 'Seat number', example: '12A', required: false, nullable: true })
	seatNumber: string | null;

	@ApiProperty({ description: 'Ticket status', example: 'active' })
	status: string;

	@ApiProperty({ description: 'Ticket issued date', example: '2024-01-10T08:00:00' })
	issuedAt: Date;

	@ApiProperty({ description: 'Booking status', example: 'confirmed' })
	bookingStatus: string;

	@ApiProperty({ description: 'Total amount', example: 1577000 })
	totalAmount: number;

	@ApiProperty({ description: 'Currency code', example: 'VND' })
	currencyCode: string;

	@ApiProperty({ description: 'Is domestic flight', example: true })
	isDomestic: boolean;

	@ApiProperty({ description: 'Can cancel ticket', example: false })
	canCancel: boolean;

	@ApiProperty({ description: 'Cancellation deadline (if can cancel)', example: '2024-01-15T07:00:00', required: false, nullable: true })
	cancellationDeadline: Date | null;

	@ApiProperty({ description: 'Reason why cannot cancel', required: false, nullable: true })
	cannotCancelReason: string | null;
}

