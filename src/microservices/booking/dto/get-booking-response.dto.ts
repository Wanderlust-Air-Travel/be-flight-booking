import { ApiProperty } from '@nestjs/swagger';

export class BookingSegmentDto {
	@ApiProperty({ description: 'Segment ID' })
	segmentId: string;

	@ApiProperty({ description: 'Flight instance details' })
	flightInstance: {
		flightInstanceId: string;
		departureDatetimeLocal: string;
		arrivalDatetimeLocal: string;
		origin: {
			airportCode: string;
			airportName: string;
			cityName: string;
		};
		destination: {
			airportCode: string;
			airportName: string;
			cityName: string;
		};
		flight: {
			flightNumber: string;
			airline: {
				airlineName: string;
			};
		};
	};

	@ApiProperty({ description: 'Fare class details' })
	fareClass: {
		fareClassCode: string;
		fareClassName: string;
	};

	@ApiProperty({ description: 'Flight seat details (optional)', required: false })
	flightSeat?: {
		seatNumber: string;
	};
}

export class BookingPassengerDto {
	@ApiProperty({ description: 'Passenger ID' })
	passengerId: string;

	@ApiProperty({ description: 'Full name' })
	fullname: string;

	@ApiProperty({ description: 'Date of birth' })
	dob: string;

	@ApiProperty({ description: 'Gender' })
	gender: string;

	@ApiProperty({ description: 'Document number' })
	documentNumber: string;
}

export class GetBookingResponseDto {
	@ApiProperty({ description: 'Booking ID' })
	bookingId: string;

	@ApiProperty({ description: 'PNR Code' })
	pnrCode: string;

	@ApiProperty({ description: 'Booking status' })
	status: string;

	@ApiProperty({ description: 'Total amount' })
	totalAmount: number;

	@ApiProperty({ description: 'Currency code' })
	currencyCode: string;

	@ApiProperty({ description: 'Contact full name (optional)', required: false })
	contactFullname?: string;

	@ApiProperty({ description: 'Contact email (optional)', required: false })
	contactEmail?: string;

	@ApiProperty({ description: 'Contact phone (optional)', required: false })
	contactPhone?: string;

	@ApiProperty({ description: 'Booking segments', type: [BookingSegmentDto] })
	segments: BookingSegmentDto[];

	@ApiProperty({ description: 'Booking passengers', type: [BookingPassengerDto] })
	passengers: BookingPassengerDto[];
}

