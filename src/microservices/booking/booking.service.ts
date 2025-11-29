import { BadRequestException, Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - uuid package is ESM but works fine with CommonJS
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
import { CreateBookingFromReservationDto } from './dto/create-booking-from-reservation.dto';
import { CreateBookingResponseDto } from './dto/create-booking-response.dto';
import { UpdateBookingPassengersDto } from './dto/update-booking-passengers.dto';
import { BookingFareDetailsResponseDto } from './dto/booking-fare-details-response.dto';
import { BookingPaymentInfoResponseDto } from './dto/booking-payment-info-response.dto';
import { FareDescriptionItemDto } from 'src/microservices/search/dto/fare-option.dto';
import { CabinType } from 'src/shared/constants/enums';
import { ReservationResponseDto } from '../reservation/dto/reservation-response.dto';
import { RESERVATION_MS } from '../reservation/reservation.messages';
import { BookingNotificationService } from './services/booking-notification.service';
import { MyTicketsResponseDto } from './dto/my-tickets-response.dto';
import { MyTicketItemDto } from './dto/my-ticket-item.dto';
import { MyJourneyResponseDto } from './dto/my-journey-response.dto';
import { MyJourneyItemDto } from './dto/my-journey-item.dto';
import { GetMyTicketsDto } from './dto/get-my-tickets.dto';
import { Ticket } from 'src/shared/entities/ticket/ticket.entity';
import { Route } from 'src/shared/entities/route/route.entity';
import { Airport } from 'src/shared/entities/airport/airport.entity';

@Injectable()
export class BookingService {
	private readonly logger = new Logger(BookingService.name);

	constructor(
		@InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
		@InjectRepository(BookingPassenger) private readonly bookingPassengerRepo: Repository<BookingPassenger>,
		@InjectRepository(BookingSegment) private readonly bookingSegmentRepo: Repository<BookingSegment>,
		@InjectRepository(FlightInstance) private readonly flightInstanceRepo: Repository<FlightInstance>,
		@InjectRepository(FlightSeat) private readonly flightSeatRepo: Repository<FlightSeat>,
		@InjectRepository(FareClass) private readonly fareClassRepo: Repository<FareClass>,
		@InjectRepository(Currency) private readonly currencyRepo: Repository<Currency>,
		@InjectRepository(Passenger) private readonly passengerRepo: Repository<Passenger>,
		@InjectRepository(User) private readonly userRepo: Repository<User>,
		@InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
		@InjectRepository(Route) private readonly routeRepo: Repository<Route>,
		@InjectRepository(Airport) private readonly airportRepo: Repository<Airport>,
		@Inject('RESERVATION_CLIENT') private readonly reservationClient: ClientProxy,
		private readonly dataSource: DataSource,
		private readonly notificationService: BookingNotificationService,
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
			} else if (code === 'Y') {
				desc.push({ text: 'Không bao gồm hành lý ký gửi', status: false });
				desc.push({ text: 'Hoàn/hủy trước giờ khởi hành: 400.000 VND (*)', status: true });
				desc.push({ text: 'Hoàn/hủy sau giờ khởi hành: 400.000 VND (*)', status: true });
				desc.push({ text: 'Thay đổi trước giờ khởi hành: 500.000 VND (*)', status: true });
				desc.push({ text: 'Thay đổi sau giờ khởi hành: 500.000 VND (*)', status: true });
				desc.push({ text: 'Hệ số cộng điểm Bamboo Club: 0.5', status: true });
				desc.push({ text: 'Chọn ghế ngồi mất phí', status: true });
				desc.push({ text: 'Không áp dụng cho go-show', status: false });
			} else if (code.includes('SM') || code === 'YS') {
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
			if (code === 'J') {
				desc.push({ text: '01 kiện hành lý ký gửi 30kg', status: true });
				desc.push({ text: 'Hoàn/hủy trước giờ khởi hành: 400.000 VND (*)', status: true });
				desc.push({ text: 'Hoàn/hủy sau giờ khởi hành: 400.000 VND (*)', status: true });
				desc.push({ text: 'Thay đổi trước giờ khởi hành: 350.000 VND (*)', status: true });
				desc.push({ text: 'Thay đổi sau giờ khởi hành: 350.000 VND (*)', status: true });
				desc.push({ text: 'Hệ số cộng điểm Bamboo Club: 1.5', status: true });
				desc.push({ text: 'Chọn ghế ngồi miễn phí', status: true });
				desc.push({ text: 'Ưu tiên check-in và lên máy bay', status: true });
			} else if (code.includes('SM') || code === 'JS') {
				desc.push({ text: '01 kiện hành lý ký gửi 30kg', status: true });
				desc.push({ text: 'Hoàn/hủy trước giờ khởi hành: 450.000 VND (*)', status: true });
				desc.push({ text: 'Hoàn/hủy sau giờ khởi hành: 800.000 VND (*)', status: true });
				desc.push({ text: 'Thay đổi trước giờ khởi hành: 300.000 VND (*)', status: true });
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
			Y: 'Economy Standard',
			YS: 'Economy Smart',
			YF: 'Economy Flex',
			YFLX: 'Economy Flex',
			J: 'Business Standard',
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
			if (description.toLowerCase().includes('standard')) {
				// Check if it's Business or Economy Standard
				if (description.toLowerCase().includes('business')) return 'Business Standard';
				return 'Economy Standard';
			}
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

			// Validate flight instances and fare classes, and calculate prices
			const validatedSegments: Array<{
				flightInstance: FlightInstance;
				fareClass: FareClass;
				baseFare: number;
				taxAmount: number;
				feeAmount: number;
			}> = [];

			for (const segment of dto.segments) {
				const flightInstance = await queryRunner.manager.findOne(FlightInstance, {
					where: { flight_instance_id: segment.flightInstanceId },
					relations: ['aircraft', 'aircraft.aircraft_type'],
				});
				if (!flightInstance) {
					throw new NotFoundException(`Flight instance ${segment.flightInstanceId} not found`);
				}

				const fareClass = await queryRunner.manager.findOne(FareClass, {
					where: { fare_class_code: segment.fareClassCode },
					relations: ['cabin_class'],
				});
				if (!fareClass) {
					throw new NotFoundException(`Fare class ${segment.fareClassCode} not found`);
				}

				// Determine cabin type from fare class
				const cabinType =
					fareClass.cabin_class.cabin_class_code === 'Y' ? CabinType.ECONOMY : CabinType.BUSINESS;

				// Calculate price from database (same logic as Search Service)
				// If price is provided in request, use it (for price lock), otherwise calculate from database
				const calculatedBaseFare = this.calculateFarePrice(fareClass.fare_class_code, cabinType);
				const baseFare = segment.baseFare ?? calculatedBaseFare;
				const taxAmount = segment.taxAmount ?? 0;
				const feeAmount = segment.feeAmount ?? 0;

				// Validate availability (check if there are enough seats for this fare class)
				// This is a simplified check - in production, you might want to lock seats
				const availableSeats = await queryRunner.manager
					.createQueryBuilder(FlightSeat, 'seat')
					.innerJoin('seat.seat_config', 'config')
					.innerJoin('config.cabin_class', 'cabin')
					.where('seat.flight_instance_id = :instanceId', { instanceId: segment.flightInstanceId })
					.andWhere('seat.is_available = :available', { available: true })
					.andWhere('cabin.cabin_class_code = :cabinCode', {
						cabinCode: fareClass.cabin_class.cabin_class_code,
					})
					.getCount();

				if (availableSeats < dto.passengers.length) {
					throw new BadRequestException(
						`Not enough available seats for flight ${segment.flightInstanceId}. Available: ${availableSeats}, Required: ${dto.passengers.length}`,
					);
				}

				validatedSegments.push({
					flightInstance,
					fareClass,
					baseFare,
					taxAmount,
					feeAmount,
				});
			}

			// Generate unique PNR
			const pnrCode = await this.generateUniquePNR();

			// Calculate total amount from validated segments
			const totalAmount = validatedSegments.reduce(
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
					// Use existing passenger
					passenger = await queryRunner.manager.findOne(Passenger, {
						where: { passenger_id: passengerDto.passengerId },
					});
					if (!passenger) {
						throw new NotFoundException(`Passenger ${passengerDto.passengerId} not found`);
					}
				} else {
					// Create new passenger from provided info
					if (!passengerDto.fullname || !passengerDto.dob || !passengerDto.gender || !passengerDto.documentNumber) {
						throw new BadRequestException(
							'If passengerId is not provided, fullname, dob, gender, and documentNumber are required',
						);
					}

					// Validate date format
					const dobDate = new Date(passengerDto.dob);
					if (isNaN(dobDate.getTime())) {
						throw new BadRequestException('Invalid date format for dob. Use YYYY-MM-DD format');
					}

					// Check if passenger with same document number already exists for this user
					// Best Practice: Reuse passenger to avoid duplicates and improve UX
					// Note: user_id is @RelationId, must use relation in where clause
					const existingPassenger = user?.user_id
						? await queryRunner.manager.findOne(Passenger, {
								where: {
									document_number: passengerDto.documentNumber,
									user: { user_id: user.user_id }, // Use relation, not direct column
								},
						  })
						: null;

					if (existingPassenger) {
						// Validate that new information matches existing passenger
						// This prevents data inconsistency and potential fraud
						const existingDob = existingPassenger.dob instanceof Date 
							? existingPassenger.dob 
							: new Date(existingPassenger.dob);
						const existingDobStr = existingDob.toISOString().split('T')[0];
						const newDobStr = dobDate.toISOString().split('T')[0];
						const dobMatches = existingDobStr === newDobStr;
						
						const fullnameMatches =
							existingPassenger.fullname.trim().toLowerCase() === passengerDto.fullname.trim().toLowerCase();
						const genderMatches = existingPassenger.gender.toLowerCase() === passengerDto.gender.toLowerCase();

						if (!dobMatches || !fullnameMatches || !genderMatches) {
							// Information mismatch - could be different person or data error
							// Log warning but allow booking (user might have updated their info)
							console.warn(
								`Passenger reuse warning: Document number ${passengerDto.documentNumber} exists but information differs. ` +
									`Existing: ${existingPassenger.fullname}, ${existingPassenger.dob}, ${existingPassenger.gender}. ` +
									`New: ${passengerDto.fullname}, ${passengerDto.dob}, ${passengerDto.gender}. ` +
									`Using existing passenger record.`,
							);
						} else {
							console.log(
								`Reusing existing passenger: ${existingPassenger.passenger_id} (${existingPassenger.fullname}, ${existingPassenger.document_number})`,
							);
						}

						// Reuse existing passenger (best practice: avoid duplicates)
						passenger = existingPassenger;
					} else {
						// Create new passenger
						passenger = this.passengerRepo.create({
							passenger_id: uuidv7(),
							user: user,
							fullname: passengerDto.fullname,
							dob: dobDate,
							gender: passengerDto.gender,
							document_number: passengerDto.documentNumber,
							loyalty_number: passengerDto.loyaltyNumber || null,
						});
						passenger = await queryRunner.manager.save(passenger);
						console.log(
							`Created new passenger: ${passenger.passenger_id} (${passenger.fullname}, ${passenger.document_number})`,
						);
					}
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
			for (let i = 0; i < validatedSegments.length; i++) {
				const validatedSegment = validatedSegments[i];
				const segmentDto = dto.segments[i];
				const bookingPassenger = bookingPassengers[i % bookingPassengers.length]; // Round-robin assignment

				const flightInstance = validatedSegment.flightInstance;
				const fareClass = validatedSegment.fareClass;

				const bookingSegment = this.bookingSegmentRepo.create({
					booking_segment_id: uuidv7(),
					booking: savedBooking,
					booking_passenger: bookingPassenger,
					flight_instance: flightInstance,
					fare_class: fareClass,
					base_fare: validatedSegment.baseFare,
					tax_amount: validatedSegment.taxAmount,
					fee_amount: validatedSegment.feeAmount,
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

			// Booking confirmation email removed - tickets will be sent after payment success

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
	 * Get full booking details by booking ID
	 */
	async getBooking(bookingId: string, userId: string | null = null): Promise<any> {
		const booking = await this.bookingRepo
			.createQueryBuilder('booking')
			.leftJoinAndSelect('booking.currency', 'currency')
			.leftJoinAndSelect('booking.user', 'user')
			.leftJoinAndSelect('booking.booking_segments', 'segments')
			.leftJoinAndSelect('segments.flight_instance', 'flightInstance')
			.leftJoinAndSelect('flightInstance.flight_schedule', 'flightSchedule')
			.leftJoinAndSelect('flightSchedule.route', 'route')
			.leftJoinAndSelect('route.origin_airport', 'originAirport')
			.leftJoinAndSelect('route.destination_airport', 'destinationAirport')
			.leftJoinAndSelect('segments.fare_class', 'fareClass')
			.leftJoinAndSelect('segments.flight_seat', 'flightSeat')
			.leftJoinAndSelect('booking.booking_passengers', 'bookingPassengers')
			.leftJoinAndSelect('bookingPassengers.passenger', 'passenger')
			.where('booking.booking_id = :bookingId', { bookingId })
			.getOne();

		if (!booking) {
			throw new NotFoundException(`Booking ${bookingId} not found`);
		}

		// Validate ownership: if userId is provided, booking must belong to that user
		// If userId is null (guest), booking must not have a user
		if (userId !== null) {
			if (!booking.user || booking.user.user_id !== userId) {
				throw new BadRequestException('Booking does not belong to the current user');
			}
		} else {
			// Guest booking - should not have a user
			if (booking.user) {
				throw new BadRequestException('This booking belongs to a registered user. Please log in to view it.');
			}
		}

		// Map segments
		const segments = booking.booking_segments.map((segment) => {
			const flightInstance = segment.flight_instance;
			const flightSchedule = flightInstance?.flight_schedule;
			const route = flightSchedule?.route;
			const originAirport = route?.origin_airport;
			const destinationAirport = route?.destination_airport;

			if (!flightInstance || !flightSchedule || !route || !originAirport || !destinationAirport) {
				this.logger.error(
					`Missing relations for segment ${segment.booking_segment_id}: flightInstance=${!!flightInstance}, flightSchedule=${!!flightSchedule}, route=${!!route}, originAirport=${!!originAirport}, destinationAirport=${!!destinationAirport}`,
				);
				throw new BadRequestException(`Incomplete flight data for segment ${segment.booking_segment_id}`);
			}

			// Handle datetime fields: could be Date object or string from database
			const formatDateTime = (dt: Date | string): string => {
				if (dt instanceof Date) {
					return dt.toISOString();
				} else if (typeof dt === 'string') {
					const dateObj = new Date(dt);
					if (!isNaN(dateObj.getTime())) {
						return dateObj.toISOString();
					}
					return dt; // Fallback: return string as-is
				}
				return new Date().toISOString(); // Fallback: current date
			};

			return {
				segmentId: segment.booking_segment_id,
				flightInstance: {
					flightInstanceId: flightInstance.flight_instance_id,
					departureDatetimeLocal: formatDateTime(flightInstance.departure_datetime_local),
					arrivalDatetimeLocal: formatDateTime(flightInstance.arrival_datetime_local),
					origin: {
						airportCode: originAirport.iata_code,
						airportName: originAirport.name,
						cityName: originAirport.city,
					},
					destination: {
						airportCode: destinationAirport.iata_code,
						airportName: destinationAirport.name,
						cityName: destinationAirport.city,
					},
					flight: {
						flightNumber: flightSchedule.flight_number,
						airline: {
							airlineName: 'Bamboo Airways', // Default airline name, can be enhanced later
						},
					},
				},
				fareClass: {
					fareClassCode: segment.fare_class.fare_class_code,
					fareClassName: this.getFareClassName(segment.fare_class.fare_class_code, segment.fare_class.description),
				},
				flightSeat: segment.flight_seat
					? {
							seatNumber: segment.flight_seat.seat_number,
						}
					: undefined,
			};
		});

		// Map passengers
		const passengers = booking.booking_passengers.map((bp) => {
			if (!bp.passenger) {
				this.logger.error(`Passenger is null for booking_passenger ${bp.booking_passenger_id}`);
				throw new BadRequestException(`Passenger data is missing for booking ${bookingId}`);
			}

			// Handle dob: could be Date object or string from database
			let dobString: string;
			if (!bp.passenger.dob) {
				this.logger.warn(`DOB is missing for passenger ${bp.passenger.passenger_id}`);
				dobString = new Date().toISOString(); // Default to current date
			} else if (bp.passenger.dob instanceof Date) {
				dobString = bp.passenger.dob.toISOString();
			} else if (typeof bp.passenger.dob === 'string') {
				// If it's already a string, try to parse and convert to ISO string
				const dobDate = new Date(bp.passenger.dob);
				if (!isNaN(dobDate.getTime())) {
					dobString = dobDate.toISOString();
				} else {
					// Fallback: use the string as-is if parsing fails
					this.logger.warn(`Invalid dob string for passenger ${bp.passenger.passenger_id}: ${bp.passenger.dob}`);
					dobString = bp.passenger.dob;
				}
			} else {
				// Fallback for other types
				this.logger.warn(`Invalid dob type for passenger ${bp.passenger.passenger_id}: ${typeof bp.passenger.dob}`);
				dobString = new Date().toISOString(); // Default to current date
			}

			return {
				passengerId: bp.passenger.passenger_id,
				fullname: bp.passenger.fullname,
				dob: dobString,
				gender: bp.passenger.gender,
				documentNumber: bp.passenger.document_number,
			};
		});

		return {
			bookingId: booking.booking_id,
			pnrCode: booking.pnr_code,
			status: booking.status,
			totalAmount: Number(booking.total_amount),
			currencyCode: booking.currency.currency_code,
			contactFullname: booking.contact_fullname || undefined,
			contactEmail: booking.contact_email || undefined,
			contactPhone: booking.contact_phone || undefined,
			segments,
			passengers,
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

	/**
	 * Calculate fare price from fare class code and cabin type
	 * Same logic as Search Service to ensure consistency
	 */
	private calculateFarePrice(fareClassCode: string, cabinType: CabinType): number {
		// Base pricing logic - same as Search Service
		// For now, using fixed prices based on fare class code patterns
		// In production, this could be enhanced with dynamic pricing from database
		const code = fareClassCode.toUpperCase();

		if (cabinType === CabinType.ECONOMY) {
			if (code.includes('SMX') || code.includes('SAVER')) {
				return 1448000; // Economy Saver Max
			}
			if (code === 'Y') {
				return 1577000; // Economy Standard
			}
			if (code.includes('SM') || code === 'YS') {
				return 1577000; // Economy Smart
			}
			if (code.includes('FLX') || code.includes('FLEX') || code === 'YF') {
				return 3068000; // Economy Flex
			}
			// Default economy price
			return 1577000;
		} else if (cabinType === CabinType.BUSINESS) {
			if (code === 'J') {
				return 5022000; // Business Standard
			}
			if (code.includes('SM') || code === 'JS') {
				return 5022000; // Business Smart
			}
			if (code.includes('FLX') || code.includes('FLEX') || code === 'JF') {
				return 7074000; // Business Flex
			}
			// Default business price
			return 5022000;
		}

		return 0;
	}

	/**
	 * Create a booking from an existing reservation.
	 * This method retrieves reservation details from Redis via Reservation Service,
	 * validates the reservation, and creates a booking with the reservation's flight and fare information.
	 *
	 * @param reservationId - Reservation ID (UUID v7) or reservation code (6 alphanumeric characters)
	 * @param userId - User ID from JWT token (for validation)
	 * @param dto - Booking data (passengers and contact info only)
	 * @returns Created booking response
	 */
	async createBookingFromReservation(
		reservationId: string,
		userId: string | null, // null for guest bookings
		dto: CreateBookingFromReservationDto,
	): Promise<CreateBookingResponseDto> {
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			// Step 1: Get reservation from Reservation Service
			let reservation: ReservationResponseDto;
			try {
				reservation = await firstValueFrom(
					this.reservationClient.send<ReservationResponseDto>(
						RESERVATION_MS.PATTERN.GET_RESERVATION,
						reservationId,
					),
				);
			} catch (error: any) {
				if (error?.statusCode === 404 || error?.message?.includes('not found')) {
					throw new NotFoundException(`Reservation ${reservationId} not found or expired`);
				}
				if (error?.statusCode === 400 || error?.message?.includes('expired')) {
					throw new BadRequestException('Reservation has expired. Please create a new reservation.');
				}
				throw new BadRequestException(`Failed to retrieve reservation: ${error?.message || 'Unknown error'}`);
			}

			// Step 2: Validate reservation expiration
			// BEST PRACTICE: Check expiresAt FIRST (Primary - Source of Truth)
			// expiresAt is the authoritative timestamp, not dependent on background jobs or status updates
			// This ensures real-time accuracy and prevents race conditions
			const now = new Date();
			const expiresAt = new Date(reservation.expiresAt);
			if (expiresAt < now) {
				throw new BadRequestException(
					`Reservation has expired at ${expiresAt.toISOString()}. Current time: ${now.toISOString()}. Please create a new reservation.`,
				);
			}

			// Step 3: Validate reservation status
			// BEST PRACTICE: Check status SECOND (Secondary - Optimization & Business Logic)
			// Status check is for optimization (early rejection) and business logic (cancelled, converted)
			// Accept both 'active' (from Redis cache) and 'pending' (from Database) as valid
			// Reject 'expired', 'cancelled', 'converted' statuses
			if (reservation.status === 'expired' || reservation.status === 'cancelled' || reservation.status === 'converted') {
				throw new BadRequestException(
					`Cannot create booking from reservation with status: ${reservation.status}. Reservation must be active or pending.`,
				);
			}

			// Step 3.5: Validate reservation ownership (if userId is stored in reservation)
			// For guest bookings (userId is null), skip ownership validation
			// For authenticated bookings, validate ownership
			if (userId && reservation.userId && reservation.userId !== userId) {
				throw new BadRequestException(
					'Reservation does not belong to the current user. You can only create bookings from your own reservations.',
				);
			}

			// Step 4: Validate number of passengers matches reservation
			if (dto.passengers.length !== reservation.numberOfPassengers) {
				throw new BadRequestException(
					`Number of passengers (${dto.passengers.length}) does not match reservation (${reservation.numberOfPassengers})`,
				);
			}

			// Step 5: Get user info (if userId is provided - for authenticated bookings)
			// For guest bookings, userId will be null/undefined
			let user: User | null = null;
			if (userId) {
				user = await queryRunner.manager.findOne(User, { where: { user_id: userId } });
				if (!user) {
					throw new NotFoundException(`User ${userId} not found`);
				}
			}

			// Step 6: Determine contact info
			// For guest bookings, contact info is REQUIRED in DTO
			// For authenticated bookings, contact info is optional (will use user info if not provided)
			let contactFullname = dto.contactFullname;
			let contactEmail = dto.contactEmail;
			let contactPhone = dto.contactPhone;

			// For guest bookings, contact info must be provided
			if (!user) {
				if (!contactFullname || !contactEmail || !contactPhone) {
					throw new BadRequestException(
						'Contact information (fullname, email, phone) is required for guest bookings.',
					);
				}
			} else {
				// For authenticated bookings, use user info as fallback
				if (!contactFullname || !contactEmail || !contactPhone) {
					if (dto.passengers && dto.passengers.length === 1 && dto.passengers[0].passengerId) {
						const passenger = await queryRunner.manager.findOne(Passenger, {
							where: { passenger_id: dto.passengers[0].passengerId },
						});

						if (passenger && passenger.user_id === userId) {
							contactFullname = contactFullname || passenger.fullname;
							contactEmail = contactEmail || user.email;
							contactPhone = contactPhone || user.phone || '';
						} else {
							contactFullname = contactFullname || user.fullname;
							contactEmail = contactEmail || user.email;
							contactPhone = contactPhone || user.phone || '';
						}
					} else {
						contactFullname = contactFullname || user.fullname;
						contactEmail = contactEmail || user.email;
						contactPhone = contactPhone || user.phone || '';
					}
				}
			}

			// Step 7: Validate currency
			const currency = await queryRunner.manager.findOne(Currency, {
				where: { currency_code: reservation.currencyCode },
			});
			if (!currency) {
				throw new NotFoundException(`Currency ${reservation.currencyCode} not found`);
			}

			// Step 8: Validate all segments from reservation (supports multi-segment for round-trip)
			const validatedSegments: Array<{
				flightInstance: FlightInstance;
				fareClass: FareClass;
				baseFare: number;
				taxAmount: number;
				feeAmount: number;
			}> = [];

			// Validate that reservation has segments array (required)
			if (!reservation.segments || reservation.segments.length === 0) {
				throw new BadRequestException(
					'Reservation must have at least one segment. Invalid reservation format.',
				);
			}

			for (const segment of reservation.segments) {
				const flightInstance = await queryRunner.manager.findOne(FlightInstance, {
					where: { flight_instance_id: segment.flightInstanceId },
					relations: ['aircraft', 'aircraft.aircraft_type'],
				});
				if (!flightInstance) {
					throw new NotFoundException(`Flight instance ${segment.flightInstanceId} not found`);
				}

				const fareClass = await queryRunner.manager.findOne(FareClass, {
					where: { fare_class_code: segment.fareClassCode },
					relations: ['cabin_class'],
				});
				if (!fareClass) {
					throw new NotFoundException(`Fare class ${segment.fareClassCode} not found`);
				}

				// Step 9: Validate availability (re-check seats) for each segment
				const availableSeats = await queryRunner.manager
					.createQueryBuilder(FlightSeat, 'seat')
					.innerJoin('seat.seat_config', 'config')
					.innerJoin('config.cabin_class', 'cabin')
					.where('seat.flight_instance_id = :instanceId', { instanceId: segment.flightInstanceId })
					.andWhere('seat.is_available = :available', { available: true })
					.andWhere('cabin.cabin_class_code = :cabinCode', {
						cabinCode: fareClass.cabin_class.cabin_class_code,
					})
					.getCount();

				if (availableSeats < reservation.numberOfPassengers) {
					throw new BadRequestException(
						`Not enough available seats for flight ${segment.flightInstanceId}. Available: ${availableSeats}, Required: ${reservation.numberOfPassengers}`,
					);
				}

				validatedSegments.push({
					flightInstance,
					fareClass,
					baseFare: segment.baseFare,
					taxAmount: segment.taxAmount,
					feeAmount: segment.feeAmount,
				});
			}

			// Step 10: Generate unique PNR
			const pnrCode = await this.generateUniquePNR();

			// Step 11: Calculate total amount from reservation (already calculated in reservation)
			const totalAmount = reservation.totalAmount;

			// Step 12: Create booking
			const booking = this.bookingRepo.create({
				booking_id: uuidv7(),
				pnr_code: pnrCode,
				user: user,
				currency: currency,
				total_amount: totalAmount,
				status: 'pending',
				channel: dto.channel || 'web',
				contact_fullname: contactFullname,
				contact_email: contactEmail,
				contact_phone: contactPhone,
			});
			const savedBooking = await queryRunner.manager.save(booking);

			// Step 13: Create booking passengers
			const bookingPassengers: BookingPassenger[] = [];
			for (const passengerDto of dto.passengers) {
				let passenger: Passenger | null = null;

				if (passengerDto.passengerId) {
					// For guest bookings, passengerId should not be provided (passengers are created fresh)
					if (!user) {
						throw new BadRequestException(
							'Cannot use existing passenger ID for guest bookings. Please provide passenger information.',
						);
					}
					
					passenger = await queryRunner.manager.findOne(Passenger, {
						where: { passenger_id: passengerDto.passengerId },
					});
					if (!passenger) {
						throw new NotFoundException(`Passenger ${passengerDto.passengerId} not found`);
					}
					if (passenger.user_id && passenger.user_id !== userId) {
						throw new BadRequestException(
							`Passenger ${passengerDto.passengerId} does not belong to the current user`,
						);
					}
				} else {
					if (!passengerDto.fullname || !passengerDto.dob || !passengerDto.gender || !passengerDto.documentNumber) {
						throw new BadRequestException(
							'If passengerId is not provided, fullname, dob, gender, and documentNumber are required',
						);
					}

					const dobDate = new Date(passengerDto.dob);
					if (isNaN(dobDate.getTime())) {
						throw new BadRequestException('Invalid date format for dob. Use YYYY-MM-DD format');
					}

					// Check if passenger with same document number already exists for this user
					// Best Practice: Reuse passenger to avoid duplicates and improve UX
					// Note: user_id is @RelationId, must use relation in where clause
					const existingPassenger = user?.user_id
						? await queryRunner.manager.findOne(Passenger, {
								where: {
									document_number: passengerDto.documentNumber,
									user: { user_id: user.user_id }, // Use relation, not direct column
								},
						  })
						: null;

					if (existingPassenger) {
						// Validate that new information matches existing passenger
						// This prevents data inconsistency and potential fraud
						const existingDob = existingPassenger.dob instanceof Date 
							? existingPassenger.dob 
							: new Date(existingPassenger.dob);
						const existingDobStr = existingDob.toISOString().split('T')[0];
						const newDobStr = dobDate.toISOString().split('T')[0];
						const dobMatches = existingDobStr === newDobStr;
						
						const fullnameMatches =
							existingPassenger.fullname.trim().toLowerCase() === passengerDto.fullname.trim().toLowerCase();
						const genderMatches = existingPassenger.gender.toLowerCase() === passengerDto.gender.toLowerCase();

						if (!dobMatches || !fullnameMatches || !genderMatches) {
							// Information mismatch - could be different person or data error
							// Log warning but allow booking (user might have updated their info)
							console.warn(
								`Passenger reuse warning: Document number ${passengerDto.documentNumber} exists but information differs. ` +
									`Existing: ${existingPassenger.fullname}, ${existingPassenger.dob}, ${existingPassenger.gender}. ` +
									`New: ${passengerDto.fullname}, ${passengerDto.dob}, ${passengerDto.gender}. ` +
									`Using existing passenger record.`,
							);
						} else {
							console.log(
								`Reusing existing passenger: ${existingPassenger.passenger_id} (${existingPassenger.fullname}, ${existingPassenger.document_number})`,
							);
						}

						// Reuse existing passenger (best practice: avoid duplicates)
						passenger = existingPassenger;
					} else {
						// Create new passenger
						// For guest bookings (user = null), passenger is created without user_id
						// For authenticated bookings, passenger is linked to user
						passenger = this.passengerRepo.create({
							passenger_id: uuidv7(),
							user: user || null, // null for guest bookings
							fullname: passengerDto.fullname,
							dob: dobDate,
							gender: passengerDto.gender,
							document_number: passengerDto.documentNumber,
							loyalty_number: passengerDto.loyaltyNumber || null,
						});
						passenger = await queryRunner.manager.save(passenger);
						console.log(
							`Created new passenger: ${passenger.passenger_id} (${passenger.fullname}, ${passenger.document_number}) ${user ? `for user ${user.user_id}` : 'as guest'}`,
						);
					}
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

			// Step 14: Create booking segments from reservation (supports multiple segments)
			// For each segment in reservation, create booking segments for all passengers
			// Map reservation segments to validated segments by flightInstanceId
			const reservationSegmentMap = new Map(
				reservation.segments.map((seg) => [seg.flightInstanceId, seg]),
			);

			for (let i = 0; i < validatedSegments.length; i++) {
				const validatedSegment = validatedSegments[i];
				const reservationSegment = reservationSegmentMap.get(validatedSegment.flightInstance.flight_instance_id);

				for (let passengerIndex = 0; passengerIndex < bookingPassengers.length; passengerIndex++) {
					const bookingPassenger = bookingPassengers[passengerIndex];
					
					// Assign seat if available from reservation
					// For multiple passengers, assign seat only to the first passenger if seat was selected
					// (In real scenario, you might want to assign seats to all passengers)
					let flightSeat: FlightSeat | null = null;
					if (reservationSegment?.flightSeatId && passengerIndex === 0) {
						flightSeat = await queryRunner.manager.findOne(FlightSeat, {
							where: { flight_seat_id: reservationSegment.flightSeatId },
						});
						if (!flightSeat) {
							console.warn(
								`Flight seat ${reservationSegment.flightSeatId} from reservation not found. Creating segment without seat assignment.`,
							);
						} else {
							// Ensure seat is still unavailable (should be from reservation)
							flightSeat.is_available = false;
							await queryRunner.manager.save(flightSeat);
						}
					}

					const bookingSegment = this.bookingSegmentRepo.create({
						booking_segment_id: uuidv7(),
						booking: savedBooking,
						booking_passenger: bookingPassenger,
						flight_instance: validatedSegment.flightInstance,
						fare_class: validatedSegment.fareClass,
						base_fare: validatedSegment.baseFare,
						tax_amount: validatedSegment.taxAmount,
						fee_amount: validatedSegment.feeAmount,
						status: 'booked',
						flight_seat: flightSeat, // Assign seat from reservation if available
					});
					await queryRunner.manager.save(bookingSegment);
				}
			}

			// Step 15: Mark reservation as converted after successful booking creation
			try {
				await firstValueFrom(
					this.reservationClient.send<void>(
						RESERVATION_MS.PATTERN.MARK_RESERVATION_AS_CONVERTED,
						reservation.reservationId,
					),
				);
			} catch (error: any) {
				// Log error but don't fail the booking creation
				console.error(
					`Failed to mark reservation ${reservation.reservationId} as converted after booking creation:`,
					error,
				);
				// Continue with booking creation even if reservation update fails
			}

			// Commit transaction
			await queryRunner.commitTransaction();

			// Booking confirmation email removed - tickets will be sent after payment success

			return {
				bookingId: savedBooking.booking_id,
				pnrCode: savedBooking.pnr_code,
				totalAmount: savedBooking.total_amount,
				currencyCode: savedBooking.currency.currency_code,
				status: savedBooking.status,
			};
		} catch (error: any) {
			await queryRunner.rollbackTransaction();
			this.logger.error('Create booking from reservation error:', {
				error: error?.message || error,
				stack: error?.stack,
				reservationId,
				userId,
			});
			// Re-throw with better error message
			if (error?.statusCode && error?.message) {
				throw error; // NestJS exception
			}
			throw new Error(`Failed to create booking from reservation: ${error?.message || error?.toString() || 'Unknown error'}`);
		} finally {
			await queryRunner.release();
		}
	}

	/**
	 * Get user's tickets with pagination
	 * Returns all tickets booked by the user, ordered by issued date (newest first)
	 */
	async getMyTickets(userId: string, dto: GetMyTicketsDto): Promise<MyTicketsResponseDto> {
		const page = dto.page ?? 1;
		const limit = dto.limit ?? 10;
		const skip = (page - 1) * limit;

		// Validate user exists
		const user = await this.userRepo.findOne({ where: { user_id: userId } });
		if (!user) {
			throw new NotFoundException(`User ${userId} not found`);
		}

		// Use QueryBuilder for better control over relations
		// Load all necessary relations including booking_segments with full nested relations
		const queryBuilder = this.ticketRepo
			.createQueryBuilder('ticket')
			.innerJoin('ticket.booking', 'booking')
			.innerJoin('booking.user', 'user')
			.leftJoinAndSelect('ticket.booking', 'booking_full')
			.leftJoinAndSelect('booking_full.currency', 'currency')
			.leftJoinAndSelect('ticket.booking_passenger', 'booking_passenger')
			.leftJoinAndSelect('booking_passenger.passenger', 'passenger')
			.leftJoinAndSelect('booking_full.booking_segments', 'segments')
			.leftJoinAndSelect('segments.booking_passenger', 'segment_booking_passenger')
			.leftJoinAndSelect('segments.flight_instance', 'flight_instance')
			.leftJoinAndSelect('flight_instance.flight_schedule', 'flight_schedule')
			.leftJoinAndSelect('flight_schedule.route', 'route')
			.leftJoinAndSelect('route.origin_airport', 'origin_airport')
			.leftJoinAndSelect('route.destination_airport', 'destination_airport')
			.leftJoinAndSelect('segments.fare_class', 'fare_class')
			.leftJoinAndSelect('fare_class.cabin_class', 'cabin_class')
			.leftJoinAndSelect('segments.flight_seat', 'flight_seat')
			.where('user.user_id = :userId', { userId })
			.orderBy('ticket.issued_at', 'DESC')
			.skip(skip)
			.take(limit);

		const [tickets, totalItems] = await queryBuilder.getManyAndCount();

		// If no tickets found, return empty result
		if (!tickets || tickets.length === 0) {
			return {
				tickets: [],
				currentPage: page,
				pageSize: limit,
				totalItems: 0,
				totalPages: 0,
				hasNextPage: false,
				hasPreviousPage: false,
			};
		}

		// Transform tickets to DTOs
		// Filter out null results (tickets that couldn't be processed)
		const ticketItemsRaw = await Promise.all(
			tickets.map(async (ticket) => {
				try {
					// Get segments for this ticket's passenger
					// A passenger can have multiple segments (e.g., round trip), so we get the first one
					// If booking_segments is not loaded, reload the booking with segments
					let segments = ticket.booking?.booking_segments;
					
					if (!segments || segments.length === 0) {
						// Reload booking with segments if not loaded
						this.logger.warn(
							`Booking segments not loaded for ticket ${ticket.ticket_id}, reloading booking...`,
						);
						const reloadedBooking = await this.bookingRepo.findOne({
							where: { booking_id: ticket.booking.booking_id },
							relations: [
								'booking_segments',
								'booking_segments.booking_passenger',
								'booking_segments.flight_instance',
								'booking_segments.flight_instance.flight_schedule',
								'booking_segments.flight_instance.flight_schedule.route',
								'booking_segments.flight_instance.flight_schedule.route.origin_airport',
								'booking_segments.flight_instance.flight_schedule.route.destination_airport',
								'booking_segments.fare_class',
								'booking_segments.fare_class.cabin_class',
								'booking_segments.flight_seat',
							],
						});
						segments = reloadedBooking?.booking_segments || [];
						if (reloadedBooking) {
							ticket.booking = reloadedBooking;
						}
					}

					// Find segment(s) for this ticket's passenger
					// A ticket is typically for one segment, but a passenger can have multiple segments
					const passengerSegments = segments.filter(
						(seg) => seg.booking_passenger?.booking_passenger_id === ticket.booking_passenger?.booking_passenger_id,
					);

					if (!passengerSegments || passengerSegments.length === 0) {
						this.logger.error(
							`No segment found for ticket ${ticket.ticket_id}, passenger ${ticket.booking_passenger?.booking_passenger_id}, booking ${ticket.booking?.booking_id}`,
						);
						// Skip this ticket instead of throwing error
						this.logger.warn(`Skipping ticket ${ticket.ticket_id} due to missing segment`);
						return null;
					}

					// Use the first segment (for one-way) or the segment with earliest departure (for round trip)
					const segment = passengerSegments.sort((a, b) => {
						const aTime = a.flight_instance?.departure_datetime_local
							? new Date(a.flight_instance.departure_datetime_local).getTime()
							: 0;
						const bTime = b.flight_instance?.departure_datetime_local
							? new Date(b.flight_instance.departure_datetime_local).getTime()
							: 0;
						return aTime - bTime;
					})[0];

					const flightInstance = segment.flight_instance;
					if (!flightInstance) {
						this.logger.error(`Flight instance not found for segment ${segment.booking_segment_id}`);
						throw new Error(`Flight instance not found for ticket ${ticket.ticket_id}`);
					}

					const schedule = flightInstance.flight_schedule;
					if (!schedule) {
						this.logger.error(`Flight schedule not found for flight instance ${flightInstance.flight_instance_id}`);
						throw new Error(`Flight schedule not found for ticket ${ticket.ticket_id}`);
					}

					const route = schedule.route;
					if (!route) {
						this.logger.error(`Route not found for flight schedule ${schedule.flight_schedule_id}`);
						throw new Error(`Route not found for ticket ${ticket.ticket_id}`);
					}

					if (!route.origin_airport || !route.destination_airport) {
						this.logger.error(`Airports not found for route ${route.route_id}`);
						throw new Error(`Airports not found for ticket ${ticket.ticket_id}`);
					}

					const fareClass = segment.fare_class;
					if (!fareClass) {
						this.logger.error(`Fare class not found for segment ${segment.booking_segment_id}`);
						throw new Error(`Fare class not found for ticket ${ticket.ticket_id}`);
					}

					const isDomestic = route.is_domestic;

					// Check cancellation eligibility
					const cancellationInfo = this.checkCancellationEligibility(
						flightInstance.departure_datetime_local,
						fareClass.fare_class_code,
						isDomestic,
					);

					return {
						ticketId: ticket.ticket_id,
						ticketNumber: ticket.ticket_number,
						bookingId: ticket.booking?.booking_id || '',
						pnrCode: ticket.booking?.pnr_code || '',
						passengerName: ticket.booking_passenger?.passenger?.fullname || 'N/A',
						flightNumber: flightInstance.flight_number || 'N/A',
						originAirport: route.origin_airport.iata_code || 'N/A',
						originAirportName: route.origin_airport.name || '',
						originCity: route.origin_airport.city || '',
						destinationAirport: route.destination_airport.iata_code || 'N/A',
						destinationAirportName: route.destination_airport.name || '',
						destinationCity: route.destination_airport.city || '',
						departureDateTime: flightInstance.departure_datetime_local,
						arrivalDateTime: flightInstance.arrival_datetime_local,
						fareClassCode: fareClass.fare_class_code || 'N/A',
						fareClassName: this.getFareClassName(fareClass.fare_class_code, fareClass.description),
						cabinClass:
							fareClass.cabin_class?.cabin_class_code === 'Y'
								? 'economy'
								: fareClass.cabin_class?.cabin_class_code === 'C'
									? 'business'
									: 'economy',
						seatNumber: segment.flight_seat?.seat_number || null,
						status: ticket.status || 'active',
						issuedAt: ticket.issued_at,
						bookingStatus: ticket.booking?.status || 'pending',
						totalAmount: ticket.booking?.total_amount || 0,
						currencyCode: ticket.booking?.currency?.currency_code || 'VND',
						isDomestic,
						canCancel: cancellationInfo.canCancel,
						cancellationDeadline: cancellationInfo.deadline,
						cannotCancelReason: cancellationInfo.reason,
					};
				} catch (error: any) {
					this.logger.error(`Error transforming ticket ${ticket.ticket_id}: ${error.message}`, error.stack);
					// Return null instead of throwing to allow other tickets to be processed
					return null;
				}
			}),
		);

		// Filter out null results (tickets that couldn't be processed)
		const ticketItems: MyTicketItemDto[] = ticketItemsRaw.filter(
			(item): item is MyTicketItemDto => item !== null,
		);

		const totalPages = Math.ceil(totalItems / limit);

		return {
			tickets: ticketItems,
			currentPage: page,
			pageSize: limit,
			totalItems,
			totalPages,
			hasNextPage: page < totalPages,
			hasPreviousPage: page > 1,
		};
	}

	/**
	 * Generate unique ticket number
	 * Format: {AIRLINE_CODE}{6_DIGIT_NUMBER}
	 * Example: BBO123456, VNA789012
	 */
	private async generateUniqueTicketNumber(): Promise<string> {
		const airlines = ['BBO', 'VNA', 'VJ', 'QH'];
		let attempts = 0;
		const maxAttempts = 10;

		while (attempts < maxAttempts) {
			const airline = airlines[Math.floor(Math.random() * airlines.length)];
			const number = String(Math.floor(Math.random() * 900000) + 100000); // 100000-999999
			const ticketNumber = `${airline}${number}`;

			// Check if ticket number already exists
			const existingTicket = await this.ticketRepo.findOne({
				where: { ticket_number: ticketNumber },
			});

			if (!existingTicket) {
				return ticketNumber;
			}

			attempts++;
		}

		// Fallback: use UUID-based ticket number if all attempts fail
		const airline = airlines[Math.floor(Math.random() * airlines.length)];
		const uuidPart = uuidv7().replace(/-/g, '').substring(0, 6).toUpperCase();
		return `${airline}${uuidPart}`;
	}

	/**
	 * Create tickets from booking after successful payment
	 * Each booking segment represents one ticket for one passenger
	 * This method should be called after payment is confirmed
	 */
	async createTicketsFromBooking(bookingId: string, manager?: any): Promise<Ticket[]> {
		const repo = manager || this.bookingRepo.manager;

		// Get booking with all necessary relations
		const booking = await repo.findOne(Booking, {
			where: { booking_id: bookingId },
			relations: ['booking_segments', 'booking_segments.booking_passenger', 'tickets'],
		});

		if (!booking) {
			throw new NotFoundException(`Booking ${bookingId} not found`);
		}

		// Check if booking is paid
		if (booking.status !== 'paid') {
			throw new BadRequestException(
				`Cannot create tickets for booking ${bookingId}. Booking status is ${booking.status}, expected 'paid'.`,
			);
		}

		// Check if tickets already exist
		if (booking.tickets && booking.tickets.length > 0) {
			this.logger.log(
				`Tickets already exist for booking ${bookingId}. Skipping ticket creation. Found ${booking.tickets.length} tickets.`,
			);
			return booking.tickets;
		}

		// Create tickets for each booking segment
		const tickets: Ticket[] = [];

		for (const segment of booking.booking_segments) {
			// Generate unique ticket number
			const ticketNumber = await this.generateUniqueTicketNumber();

			// Create ticket
			const ticket = repo.create(Ticket, {
				ticket_id: uuidv7(),
				booking: booking,
				booking_passenger: segment.booking_passenger,
				ticket_number: ticketNumber,
				status: 'active',
			});

			const savedTicket = await repo.save(Ticket, ticket);
			tickets.push(savedTicket);

			this.logger.log(
				`Created ticket ${savedTicket.ticket_number} (${savedTicket.ticket_id}) for booking ${bookingId}, passenger ${segment.booking_passenger.booking_passenger_id}`,
			);
		}

		this.logger.log(`Successfully created ${tickets.length} tickets for booking ${bookingId}`);

		// PHASE 4: Send ticket confirmation email with detailed information
		// Reload booking with all relations for email
		const bookingForEmail = await repo.findOne(Booking, {
			where: { booking_id: bookingId },
			relations: [
				'currency',
				'booking_segments',
				'booking_segments.booking_passenger',
				'booking_segments.booking_passenger.passenger',
				'booking_segments.flight_instance',
				'booking_segments.flight_instance.flight_schedule',
				'booking_segments.flight_instance.flight_schedule.route',
				'booking_segments.flight_instance.flight_schedule.route.origin_airport',
				'booking_segments.flight_instance.flight_schedule.route.destination_airport',
				'booking_segments.fare_class',
				'booking_segments.fare_class.cabin_class',
				'booking_segments.flight_seat',
				'user',
			],
		});

		if (bookingForEmail) {
			// Reload tickets with relations
			const ticketsWithRelations = await repo.find(Ticket, {
				where: { booking: { booking_id: bookingId } },
				relations: ['booking_passenger'],
			});

			await this.notificationService.sendTicketConfirmation(bookingForEmail, ticketsWithRelations).catch((err) => {
				this.logger.error(`Failed to send ticket confirmation email: ${err.message}`);
			});
		}

		return tickets;
	}

	/**
	 * Get user's journey history
	 * Returns all unique flight journeys (bookings) that the user has made
	 */
	async getMyJourney(userId: string): Promise<MyJourneyResponseDto> {
		// Validate user exists
		const user = await this.userRepo.findOne({ where: { user_id: userId } });
		if (!user) {
			throw new NotFoundException(`User ${userId} not found`);
		}

		// Use QueryBuilder for better control over relations
		const bookings = await this.bookingRepo
			.createQueryBuilder('booking')
			.innerJoin('booking.user', 'user')
			.leftJoinAndSelect('booking.currency', 'currency')
			.leftJoinAndSelect('booking.booking_segments', 'segments')
			.leftJoinAndSelect('segments.flight_instance', 'flight_instance')
			.leftJoinAndSelect('flight_instance.flight_schedule', 'flight_schedule')
			.leftJoinAndSelect('flight_schedule.route', 'route')
			.leftJoinAndSelect('route.origin_airport', 'origin_airport')
			.leftJoinAndSelect('route.destination_airport', 'destination_airport')
			.leftJoinAndSelect('booking.booking_passengers', 'booking_passengers')
			.where('user.user_id = :userId', { userId })
			.orderBy('booking.created_at', 'DESC')
			.getMany();

		// Transform bookings to journey DTOs
		// For each booking, get the first segment to determine origin/destination
		const journeyItems: MyJourneyItemDto[] = bookings.map((booking) => {
			// Get the first segment for the journey
			const firstSegment = booking.booking_segments[0];
			if (!firstSegment) {
				throw new Error(`Booking ${booking.booking_id} has no segments`);
			}

			const flightInstance = firstSegment.flight_instance;
			const route = flightInstance.flight_schedule.route;

			return {
				journeyId: booking.booking_id,
				pnrCode: booking.pnr_code,
				originAirport: route.origin_airport.iata_code,
				originAirportName: route.origin_airport.name,
				originCity: route.origin_airport.city,
				destinationAirport: route.destination_airport.iata_code,
				destinationAirportName: route.destination_airport.name,
				destinationCity: route.destination_airport.city,
				departureDateTime: flightInstance.departure_datetime_local,
				arrivalDateTime: flightInstance.arrival_datetime_local,
				flightNumber: flightInstance.flight_number,
				numberOfPassengers: booking.booking_passengers.length,
				isDomestic: route.is_domestic,
				bookingDate: booking.created_at,
				status: booking.status,
			};
		});

		return {
			journeys: journeyItems,
			totalJourneys: journeyItems.length,
		};
	}

	/**
	 * Check if a ticket can be cancelled based on Bamboo Airways rules
	 * 
	 * Quy định về thời gian hủy vé của Bamboo Airways:
	 * - Chặng bay nội địa: Hoàn thiện thủ tục hoàn vé trước giờ khởi hành tối thiểu 03 tiếng
	 * - Chặng bay quốc tế: Thực hiện thủ tục hoàn vé trước giờ khởi hành ít nhất 05 tiếng
	 * 
	 * Các hạng vé được phép hoàn (thường là):
	 * - Economy Smart, Economy Flex
	 * - Premium Smart, Premium Flex
	 * - Business Smart, Business Flex
	 * 
	 * Các hạng vé KHÔNG được phép hoàn/hủy:
	 * - Economy Saver Max (YSM, SMX)
	 * - Economy Saver / Bamboo Eco
	 * Lưu ý: Các hạng vé rẻ nhất như Economy Saver Max hoặc Economy Saver (Bamboo Eco) 
	 * thông thường không được phép hoàn/hủy vé.
	 */
	private checkCancellationEligibility(
		departureDateTime: Date,
		fareClassCode: string,
		isDomestic: boolean,
	): { canCancel: boolean; deadline: Date | null; reason: string | null } {
		const code = fareClassCode.toUpperCase();

		// Check if fare class allows cancellation
		// Economy Saver Max and Economy Saver (Bamboo Eco) cannot be cancelled
		// These are the cheapest fare classes and typically do not allow refunds
		if (
			code.includes('SMX') || 
			code.includes('SAVER') || 
			code === 'YSM' ||
			code.includes('ECO') ||
			code === 'YS' // Economy Saver
		) {
			return {
				canCancel: false,
				deadline: null,
				reason: 'Hạng vé này (Economy Saver Max / Economy Saver / Bamboo Eco) không được phép hoàn/hủy theo quy định của Bamboo Airways. Các hạng vé siêu tiết kiệm thông thường không được phép hoàn/hủy vé.',
			};
		}

		// Allowed fare classes for cancellation:
		// - Economy Smart (YS), Economy Flex (YF, YFLX)
		// - Premium Smart (JS), Premium Flex (JF, JFLX)
		// - Business Smart (JS), Business Flex (JF, JFLX)
		// If fare class code doesn't match any of the non-cancellable ones above, it's allowed

		// Calculate cancellation deadline
		const now = new Date();
		const departure = new Date(departureDateTime);
		const hoursBeforeDeparture = isDomestic ? 3 : 5; // 3 hours for domestic, 5 hours for international
		const deadline = new Date(departure.getTime() - hoursBeforeDeparture * 60 * 60 * 1000);

		// Check if current time is before deadline
		if (now >= deadline) {
			return {
				canCancel: false,
				deadline,
				reason: isDomestic
					? 'Đã quá thời hạn hủy vé. Chặng bay nội địa: Hoàn thiện thủ tục hoàn vé trước giờ khởi hành tối thiểu 03 tiếng.'
					: 'Đã quá thời hạn hủy vé. Chặng bay quốc tế: Thực hiện thủ tục hoàn vé trước giờ khởi hành ít nhất 05 tiếng.',
			};
		}

		return {
			canCancel: true,
			deadline,
			reason: null,
		};
	}

	/**
	 * Cancel a booking
	 * 
	 * Rules:
	 * - Only authenticated users can cancel their own bookings
	 * - Guest bookings cannot be cancelled (need to contact support)
	 * - Booking must be in 'confirmed' or 'pending' status
	 * - Must check cancellation eligibility before cancelling
	 * - Updates booking status to 'cancelled'
	 */
	async cancelBooking(bookingId: string, userId: string): Promise<{ success: boolean; message: string }> {
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			// Find booking with relations
			const booking = await queryRunner.manager.findOne(Booking, {
				where: { booking_id: bookingId },
				relations: ['user', 'booking_segments', 'booking_segments.flight_instance', 'booking_segments.fare_class', 'booking_segments.flight_instance.flight_schedule', 'booking_segments.flight_instance.flight_schedule.route'],
			});

			if (!booking) {
				throw new NotFoundException(`Booking ${bookingId} not found`);
			}

			// Validate ownership - only authenticated users can cancel
			if (!userId) {
				throw new BadRequestException('Only authenticated users can cancel bookings. Guest bookings must contact support.');
			}

			if (!booking.user || booking.user.user_id !== userId) {
				throw new BadRequestException('Booking does not belong to the current user');
			}

			// Check if booking is already cancelled
			if (booking.status === 'cancelled') {
				throw new BadRequestException('Booking is already cancelled');
			}

			// Check if booking can be cancelled (must be pending or confirmed)
			if (booking.status !== 'pending' && booking.status !== 'confirmed') {
				throw new BadRequestException(`Cannot cancel booking with status: ${booking.status}`);
			}

			// Check cancellation eligibility for each segment
			if (booking.booking_segments && booking.booking_segments.length > 0) {
				for (const segment of booking.booking_segments) {
					const flightInstance = segment.flight_instance;
					const fareClass = segment.fare_class;
					const route = flightInstance?.flight_schedule?.route;

					if (!flightInstance || !fareClass || !route) {
						this.logger.warn(`Incomplete data for segment ${segment.booking_segment_id}, skipping eligibility check`);
						continue;
					}

					const isDomestic = route.is_domestic;
					const cancellationInfo = this.checkCancellationEligibility(
						flightInstance.departure_datetime_local,
						fareClass.fare_class_code,
						isDomestic,
					);

					if (!cancellationInfo.canCancel) {
						throw new BadRequestException(
							cancellationInfo.reason || 'This booking cannot be cancelled due to fare class restrictions or time limits',
						);
					}
				}
			}

			// Update booking status to cancelled
			booking.status = 'cancelled';
			booking.updated_at = new Date();
			await queryRunner.manager.save(Booking, booking);

			// Also cancel related tickets if they exist
			const tickets = await queryRunner.manager.find(Ticket, {
				where: { booking: { booking_id: bookingId } },
			});

			if (tickets.length > 0) {
				for (const ticket of tickets) {
					ticket.status = 'cancelled';
					await queryRunner.manager.save(Ticket, ticket);
				}
			}

			await queryRunner.commitTransaction();

			this.logger.log(`Booking ${bookingId} cancelled successfully by user ${userId}`);

			return {
				success: true,
				message: 'Booking cancelled successfully',
			};
		} catch (error: any) {
			await queryRunner.rollbackTransaction();
			this.logger.error(`Failed to cancel booking ${bookingId}: ${error.message}`, error.stack);
			throw error;
		} finally {
			await queryRunner.release();
		}
	}
}

