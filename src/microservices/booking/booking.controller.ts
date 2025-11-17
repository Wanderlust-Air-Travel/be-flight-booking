import { Controller, Logger } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { BOOKING_MS } from './booking.messages';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateBookingResponseDto } from './dto/create-booking-response.dto';
import { UpdateBookingPassengersDto } from './dto/update-booking-passengers.dto';
import { BookingFareDetailsResponseDto } from './dto/booking-fare-details-response.dto';
import { BookingPaymentInfoResponseDto } from './dto/booking-payment-info-response.dto';

@Controller()
export class BookingMsController {
	private readonly logger = new Logger(BookingMsController.name);

	constructor(private readonly bookingService: BookingService) {}

	@MessagePattern(BOOKING_MS.PATTERN.CREATE_BOOKING)
	async handleCreateBooking(dto: CreateBookingDto): Promise<CreateBookingResponseDto> {
		try {
			this.logger.log(`Create booking: ${dto.contactEmail}`);
			const result = await this.bookingService.createBooking(dto);
			this.logger.log(`Booking created: ${result.bookingId} (PNR: ${result.pnrCode})`);
			return result;
		} catch (error: any) {
			this.logger.error('Create booking error:', error);
			throw error;
		}
	}

	@MessagePattern(BOOKING_MS.PATTERN.GET_BOOKING_FARE_DETAILS)
	async handleGetBookingFareDetails(bookingId: string): Promise<BookingFareDetailsResponseDto> {
		try {
			this.logger.log(`Get booking fare details: ${bookingId}`);
			const result = await this.bookingService.getBookingFareDetails(bookingId);
			return result;
		} catch (error: any) {
			this.logger.error('Get booking fare details error:', error);
			throw error;
		}
	}

	@MessagePattern(BOOKING_MS.PATTERN.UPDATE_BOOKING_PASSENGERS)
	async handleUpdateBookingPassengers(payload: {
		bookingId: string;
		dto: UpdateBookingPassengersDto;
	}): Promise<{ success: boolean; message: string; totalPassengers: number }> {
		try {
			this.logger.log(`Update booking passengers: ${payload.bookingId}`);
			const result = await this.bookingService.updateBookingPassengers(payload.bookingId, payload.dto);
			return result;
		} catch (error: any) {
			this.logger.error('Update booking passengers error:', error);
			throw error;
		}
	}

	@MessagePattern(BOOKING_MS.PATTERN.GET_BOOKING_PAYMENT_INFO)
	async handleGetBookingPaymentInfo(bookingId: string): Promise<BookingPaymentInfoResponseDto> {
		try {
			this.logger.log(`Get booking payment info: ${bookingId}`);
			const result = await this.bookingService.getBookingPaymentInfo(bookingId);
			return result;
		} catch (error: any) {
			this.logger.error('Get booking payment info error:', error);
			throw error;
		}
	}
}

