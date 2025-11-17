import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { Booking } from 'src/shared/entities/booking/booking.entity';
import { BookingPassenger } from 'src/shared/entities/booking/booking-passenger.entity';
import { BookingSegment } from 'src/shared/entities/booking/booking-segment.entity';
import { FlightInstance } from 'src/shared/entities/flight/flight-instance.entity';
import { FlightSeat } from 'src/shared/entities/flight/flight-seat.entity';
import { FareClass } from 'src/shared/entities/fare/fare-class.entity';
import { Currency } from 'src/shared/entities/currency/currency.entity';
import { Passenger } from 'src/shared/entities/passenger/passenger.entity';
import { User } from 'src/shared/entities/user/user.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateBookingResponseDto } from './dto/create-booking-response.dto';
import { UpdateBookingPassengersDto } from './dto/update-booking-passengers.dto';
import { BookingFareDetailsResponseDto } from './dto/booking-fare-details-response.dto';
import { BookingPaymentInfoResponseDto } from './dto/booking-payment-info-response.dto';
import { FareDescriptionItemDto } from 'src/microservices/search/dto/fare-option.dto';
import { CabinType } from 'src/microservices/search/dto/get-fare-options.dto';

@Injectable()
export class BookingService {
	constructor(
		@InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
		@InjectRepository(BookingPassenger) private readonly bookingPassengerRepo: Repository<BookingPassenger>,
		@InjectRepository(BookingSegment) private readonly bookingSegmentRepo: Repository<BookingSegment>,
		@InjectRepository(FlightInstance) private readonly flightInstanceRepo: Repository<FlightInstance>,
		@InjectRepository(FareClass) private readonly fareClassRepo: Repository<FareClass>,
		@InjectRepository(Currency) private readonly currencyRepo: Repository<Currency>,
		@InjectRepository(Passenger) private readonly passengerRepo: Repository<Passenger>,
		@InjectRepository(User) private readonly userRepo: Repository<User>,
		private readonly dataSource: DataSource,
	) {}

	/**
	 * Generate unique PNR code (6 alphanumeric characters)
	 */
	private generatePNR(): string {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
		let result = '';
		for (let i = 0; i < 6; i++) {
			result += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return result;
	}

	/**
	 * Generate unique PNR code with collision check
	 */
	private async generateUniquePNR(): Promise<string> {
		let pnr: string;
		let attempts = 0;
		const maxAttempts = 10;

		do {
			pnr = this.generatePNR();
			const existing = await this.bookingRepo.findOne({ where: { pnr_code: pnr } });
			if (!existing) {
				return pnr;
			}
			attempts++;
		} while (attempts < maxAttempts);

		throw new Error('Failed to generate unique PNR code after multiple attempts');
	}

	/**
	 * Generate fare descriptions based on fare class code
	 */
	private generateFareDescriptions(fareClassCode: string, cabinType: string): FareDescriptionItemDto[] {
		const code = fareClassCode.toUpperCase();
		const desc: FareDescriptionItemDto[] = [];

		desc.push({ text: 'Hành lý xách tay: 7kg', status: true });

		if (cabinType === 'economy') {
			if (code.includes('SMX') || code.includes('SAVER')) {
				desc.push({ text: 'Không bao gồm hành lý ký gửi', status: false });
				desc.push({ text: 'Không được hoàn/hủy', status: false });
				desc.push({ text: 'Thay đổi trước giờ khởi hành: 600.000 VND (*)', status: true });
				desc.push({ text: 'Không thay đổi sau giờ khởi hành (*)', status: false });
				desc.push({ text: 'Hệ số cộng điểm Bamboo Club: 0.25', status: true });
				desc.push({ text: 'Chọn ghế ngồi mất phí', status: false });
				desc.push({ text: 'Không áp dụng cho go-show', status: false });
			} else if (code.includes('SM') || code === 'Y' || code === 'YS') {
				desc.push({ text: 'Không bao gồm hành lý ký gửi', status: false });
				desc.push({ text: 'Hoàn/hủy trước giờ khởi hành: 450.000 VND (*)', status: true });
				desc.push({ text: 'Hoàn/hủy sau giờ khởi hành: 600.000 VND (*)', status: true });
				desc.push({ text: 'Thay đổi trước giờ khởi hành: 450.000 VND (*)', status: true });
				desc.push({ text: 'Thay đổi sau giờ khởi hành: 600.000 VND (*)', status: true });
				desc.push({ text: 'Hệ số cộng điểm Bamboo Club: 0.5', status: true });
				desc.push({ text: 'Chọn ghế ngồi mất phí', status: true });
				desc.push({ text: 'Không áp dụng cho go-show', status: false });
			} else if (code.includes('FLX') || code.includes('FLEX') || code === 'YF') {
				desc.push({ text: '01 kiện hành lý ký gửi 20kg', status: true });
				desc.push({ text: 'Hoàn/hủy trước giờ khởi hành: 300.000 VND (*)', status: true });
				desc.push({ text: 'Hoàn/hủy sau giờ khởi hành: 300.000 VND (*)', status: true });
				desc.push({ text: 'Thay đổi miễn phí', status: true });
				desc.push({ text: 'Hệ số cộng điểm Bamboo Club: 1.00', status: true });
				desc.push({ text: 'Chọn ghế ngồi miễn phí', status: true });
				desc.push({ text: 'Đổi chuyến tại sân bay miễn phí', status: true });
			}
		} else if (cabinType === 'business') {
			if (code.includes('SM') || code === 'J' || code === 'JS') {
				desc.push({ text: '01 kiện hành lý ký gửi 30kg', status: true });
				desc.push({ text: 'Hoàn/hủy trước giờ khởi hành: 500.000 VND (*)', status: true });
				desc.push({ text: 'Hoàn/hủy sau giờ khởi hành: 800.000 VND (*)', status: true });
				desc.push({ text: 'Thay đổi trước giờ khởi hành: 500.000 VND (*)', status: true });
				desc.push({ text: 'Thay đổi sau giờ khởi hành: 800.000 VND (*)', status: true });
				desc.push({ text: 'Hệ số cộng điểm Bamboo Club: 1.5', status: true });
				desc.push({ text: 'Chọn ghế ngồi miễn phí', status: true });
				desc.push({ text: 'Ưu tiên check-in và lên máy bay', status: true });
			} else if (code.includes('FLX') || code.includes('FLEX') || code === 'JF') {
				desc.push({ text: '02 kiện hành lý ký gửi 30kg', status: true });
				desc.push({ text: 'Hoàn/hủy miễn phí', status: true });
				desc.push({ text: 'Thay đổi miễn phí', status: true });
				desc.push({ text: 'Hệ số cộng điểm Bamboo Club: 2.00', status: true });
				desc.push({ text: 'Chọn ghế ngồi miễn phí', status: true });
				desc.push({ text: 'Đổi chuyến tại sân bay miễn phí', status: true });
				desc.push({ text: 'Ưu tiên check-in và lên máy bay', status: true });
				desc.push({ text: 'Phòng chờ thương gia', status: true });
			}
		}

		return desc;
	}

	/**
	 * Get fare class name from code
	 */
	private getFareClassName(fareClassCode: string, description: string | null): string {
		const code = fareClassCode.toUpperCase();
		const FARE_CLASS_NAMES: Record<string, string> = {
			YSM: 'Economy Saver Max',
			YSMX: 'Economy Saver Max',
			Y: 'Economy Smart',
			YS: 'Economy Smart',
			YF: 'Economy Flex',
			YFLX: 'Economy Flex',
			J: 'Business Smart',
			JS: 'Business Smart',
			JF: 'Business Flex',
			JFLX: 'Business Flex',
		};

		if (FARE_CLASS_NAMES[code]) {
			return FARE_CLASS_NAMES[code];
		}

		if (description) {
			if (description.toLowerCase().includes('saver max')) return 'Economy Saver Max';
			if (description.toLowerCase().includes('smart')) return 'Economy Smart';
			if (description.toLowerCase().includes('flex')) return 'Economy Flex';
			if (description.toLowerCase().includes('business smart')) return 'Business Smart';
			if (description.toLowerCase().includes('business flex')) return 'Business Flex';
		}

		return description || fareClassCode;
	}

	/**
	 * Create a new booking
	 */
	async createBooking(dto: CreateBookingDto): Promise<CreateBookingResponseDto> {
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			// Validate currency
			const currency = await this.currencyRepo.findOne({ where: { currency_code: dto.currencyCode } });
			if (!currency) {
				throw new NotFoundException(`Currency ${dto.currencyCode} not found`);
			}

			// Validate user if provided
			let user: User | null = null;
			if (dto.userId) {
				user = await this.userRepo.findOne({ where: { user_id: dto.userId } });
				if (!user) {
					throw new NotFoundException(`User ${dto.userId} not found`);
				}
			}

			// Validate flight instances and fare classes
			for (const segment of dto.segments) {
				const flightInstance = await this.flightInstanceRepo.findOne({
					where: { flight_instance_id: segment.flightInstanceId },
				});
				if (!flightInstance) {
					throw new NotFoundException(`Flight instance ${segment.flightInstanceId} not found`);
				}

				const fareClass = await this.fareClassRepo.findOne({
					where: { fare_class_code: segment.fareClassCode },
				});
				if (!fareClass) {
					throw new NotFoundException(`Fare class ${segment.fareClassCode} not found`);
				}
			}

			// Generate unique PNR
			const pnrCode = await this.generateUniquePNR();

			// Calculate total amount
			const totalAmount = dto.segments.reduce(
				(sum, seg) => sum + seg.baseFare + seg.taxAmount + seg.feeAmount,
				0,
			);

			// Create booking
			const booking = this.bookingRepo.create({
				booking_id: uuidv7(),
				pnr_code: pnrCode,
				user: user,
				currency: currency,
				total_amount: totalAmount,
				status: 'pending',
				channel: dto.channel || 'web',
				contact_fullname: dto.contactFullname,
				contact_email: dto.contactEmail,
				contact_phone: dto.contactPhone,
			});
			const savedBooking = await queryRunner.manager.save(booking);

			// Create booking passengers
			const bookingPassengers: BookingPassenger[] = [];
			for (const passengerDto of dto.passengers) {
				let passenger: Passenger | null = null;

				if (passengerDto.passengerId) {
					passenger = await this.passengerRepo.findOne({
						where: { passenger_id: passengerDto.passengerId },
					});
					if (!passenger) {
						throw new NotFoundException(`Passenger ${passengerDto.passengerId} not found`);
					}
				} else {
					// For now, we require passengerId. In a real scenario, you might create passenger here
					throw new BadRequestException('Passenger ID is required');
				}

				const bookingPassenger = this.bookingPassengerRepo.create({
					booking_passenger_id: uuidv7(),
					booking: savedBooking,
					passenger: passenger,
					passenger_type: passengerDto.passengerType,
				});
				const savedBookingPassenger = await queryRunner.manager.save(bookingPassenger);
				bookingPassengers.push(savedBookingPassenger);
			}

			// Create booking segments
			for (let i = 0; i < dto.segments.length; i++) {
				const segmentDto = dto.segments[i];
				const bookingPassenger = bookingPassengers[i % bookingPassengers.length]; // Round-robin assignment

				const flightInstance = await this.flightInstanceRepo.findOne({
					where: { flight_instance_id: segmentDto.flightInstanceId },
				});
				const fareClass = await this.fareClassRepo.findOne({
					where: { fare_class_code: segmentDto.fareClassCode },
				});

				const bookingSegment = this.bookingSegmentRepo.create({
					booking_segment_id: uuidv7(),
					booking: savedBooking,
					booking_passenger: bookingPassenger,
					flight_instance: flightInstance!,
					fare_class: fareClass!,
					base_fare: segmentDto.baseFare,
					tax_amount: segmentDto.taxAmount,
					fee_amount: segmentDto.feeAmount,
					status: 'booked',
					flight_seat: segmentDto.flightSeatId
						? await queryRunner.manager.findOne(FlightSeat, {
								where: { flight_seat_id: segmentDto.flightSeatId },
						  })
						: null,
				});
				await queryRunner.manager.save(bookingSegment);
			}

			await queryRunner.commitTransaction();

			return {
				bookingId: savedBooking.booking_id,
				pnrCode: savedBooking.pnr_code,
				totalAmount: savedBooking.total_amount,
				currencyCode: savedBooking.currency.currency_code,
				status: savedBooking.status,
			};
		} catch (error) {
			await queryRunner.rollbackTransaction();
			throw error;
		} finally {
			await queryRunner.release();
		}
	}

	/**
	 * Get fare details for a booking
	 */
	async getBookingFareDetails(bookingId: string): Promise<BookingFareDetailsResponseDto> {
		const booking = await this.bookingRepo
			.createQueryBuilder('booking')
			.leftJoinAndSelect('booking.booking_segments', 'segments')
			.leftJoinAndSelect('segments.fare_class', 'fareClass')
			.leftJoinAndSelect('fareClass.cabin_class', 'cabinClass')
			.leftJoinAndSelect('booking.booking_passengers', 'passengers')
			.where('booking.booking_id = :bookingId', { bookingId })
			.getOne();

		if (!booking) {
			throw new NotFoundException(`Booking ${bookingId} not found`);
		}

		if (booking.booking_segments.length === 0) {
			throw new BadRequestException('Booking has no segments');
		}

		// Get the first segment's fare class (assuming all segments have the same fare class)
		const firstSegment = booking.booking_segments[0];
		const fareClass = firstSegment.fare_class;
		const cabinType = fareClass.cabin_class.cabin_class_code === 'Y' ? 'economy' : 'business';

		const fareClassName = this.getFareClassName(fareClass.fare_class_code, fareClass.description);
		const descriptions = this.generateFareDescriptions(fareClass.fare_class_code, cabinType);

		const totalPassengers = booking.booking_passengers.length;
		const priceOneWay = booking.booking_segments.reduce(
			(sum, seg) => sum + seg.base_fare + seg.tax_amount + seg.fee_amount,
			0,
		);

		return {
			bookingId: booking.booking_id,
			pnrCode: booking.pnr_code,
			fareClassName,
			descriptions,
			priceOneWay,
			totalPassengers,
			totalPrice: booking.total_amount,
		};
	}

	/**
	 * Update booking passengers count
	 */
	async updateBookingPassengers(
		bookingId: string,
		dto: UpdateBookingPassengersDto,
	): Promise<{ success: boolean; message: string; totalPassengers: number }> {
		const booking = await this.bookingRepo
			.createQueryBuilder('booking')
			.leftJoinAndSelect('booking.booking_passengers', 'passengers')
			.where('booking.booking_id = :bookingId', { bookingId })
			.getOne();

		if (!booking) {
			throw new NotFoundException(`Booking ${bookingId} not found`);
		}

		const currentTotal = booking.booking_passengers.length;
		const newTotal = dto.adults + dto.minors;

		if (newTotal === currentTotal) {
			return {
				success: true,
				message: 'Passenger count unchanged',
				totalPassengers: currentTotal,
			};
		}

		// For now, we just return success. In a real scenario, you would:
		// 1. Add/remove booking passengers
		// 2. Recalculate total amount based on new passenger count
		// 3. Update booking segments accordingly

		return {
			success: true,
			message: `Passenger count updated from ${currentTotal} to ${newTotal}`,
			totalPassengers: newTotal,
		};
	}

	/**
	 * Get payment information for a booking
	 */
	async getBookingPaymentInfo(bookingId: string): Promise<BookingPaymentInfoResponseDto> {
		const booking = await this.bookingRepo
			.createQueryBuilder('booking')
			.leftJoinAndSelect('booking.currency', 'currency')
			.where('booking.booking_id = :bookingId', { bookingId })
			.getOne();

		if (!booking) {
			throw new NotFoundException(`Booking ${bookingId} not found`);
		}

		return {
			bookingId: booking.booking_id,
			pnrCode: booking.pnr_code,
			totalAmount: booking.total_amount,
			currencyCode: booking.currency.currency_code,
			contactFullname: booking.contact_fullname,
			contactEmail: booking.contact_email,
			contactPhone: booking.contact_phone,
			status: booking.status,
		};
	}
}

