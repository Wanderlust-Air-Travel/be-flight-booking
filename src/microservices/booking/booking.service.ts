import { BadRequestException, Injectable, NotFoundException, Inject } from '@nestjs/common';
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

@Injectable()
export class BookingService {
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
		@Inject('RESERVATION_CLIENT') private readonly reservationClient: ClientProxy,
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
			Y: 'Economy Standard',
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
			if (description.toLowerCase().includes('standard')) return 'Economy Standard';
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
			if (code.includes('SM') || code === 'Y' || code === 'YS') {
				return 1577000; // Economy Smart
			}
			if (code.includes('FLX') || code.includes('FLEX') || code === 'YF') {
				return 3068000; // Economy Flex
			}
			// Default economy price
			return 1577000;
		} else if (cabinType === CabinType.BUSINESS) {
			if (code.includes('SM') || code === 'J' || code === 'JS') {
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
		userId: string,
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
			if (reservation.userId && reservation.userId !== userId) {
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

			// Step 5: Get user info
			const user = await queryRunner.manager.findOne(User, { where: { user_id: userId } });
			if (!user) {
				throw new NotFoundException(`User ${userId} not found`);
			}

			// Step 6: Determine contact info (same logic as createBooking)
			let contactFullname = dto.contactFullname;
			let contactEmail = dto.contactEmail;
			let contactPhone = dto.contactPhone;

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

			return {
				bookingId: savedBooking.booking_id,
				pnrCode: savedBooking.pnr_code,
				totalAmount: savedBooking.total_amount,
				currencyCode: savedBooking.currency.currency_code,
				status: savedBooking.status,
			};
		} catch (error: any) {
			await queryRunner.rollbackTransaction();
			console.error('Create booking from reservation error:', {
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
}

