import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - uuid package is ESM but works fine with CommonJS
import { v7 as uuidv7 } from 'uuid';
import { FlightInstance } from 'src/shared/entities/flight/flight-instance.entity';
import { FlightSeat } from 'src/shared/entities/flight/flight-seat.entity';
import { FareClass } from 'src/shared/entities/fare/fare-class.entity';
import { Currency } from 'src/shared/entities/currency/currency.entity';
import { Reservation } from 'src/shared/entities/reservation/reservation.entity';
import { RedisService } from 'src/shared/modules/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { BookingStateService } from 'src/shared/services/booking-state.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ReservationResponseDto } from './dto/reservation-response.dto';
import { CabinType } from 'src/shared/constants/enums';

@Injectable()
export class ReservationService {
	private readonly reservationTtl: number;

	constructor(
		@InjectRepository(FlightInstance) private readonly flightInstanceRepo: Repository<FlightInstance>,
		@InjectRepository(FlightSeat) private readonly flightSeatRepo: Repository<FlightSeat>,
		@InjectRepository(FareClass) private readonly fareClassRepo: Repository<FareClass>,
		@InjectRepository(Currency) private readonly currencyRepo: Repository<Currency>,
		@InjectRepository(Reservation) private readonly reservationRepo: Repository<Reservation>,
		private readonly redisService: RedisService,
		private readonly configService: ConfigService,
		private readonly bookingStateService: BookingStateService,
	) {
		const redisConfig = this.configService.get('redis');
		this.reservationTtl = redisConfig?.ttl?.reservation || 900; // 15 minutes default
	}

	/**
	 * Generate unique reservation code (6 alphanumeric characters)
	 */
	private generateReservationCode(): string {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
		let code = '';
		for (let i = 0; i < 6; i++) {
			code += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return code;
	}

	/**
	 * Get Redis key for reservation
	 */
	private getReservationKey(reservationId: string): string {
		return `reservation:${reservationId}`;
	}

	/**
	 * Get Redis key for reservation by code
	 */
	private getReservationCodeKey(reservationCode: string): string {
		return `reservation:code:${reservationCode}`;
	}

	/**
	 * Calculate fare price based on fare class code and cabin type
	 */
	private calculateFarePrice(fareClassCode: string, cabinType: CabinType): number {
		const code = fareClassCode.toUpperCase();
		if (cabinType === CabinType.ECONOMY) {
			if (code.includes('SMX') || code.includes('SAVER')) return 1448000;
			if (code.includes('SM') || code === 'Y' || code === 'YS') return 1577000;
			if (code.includes('FLX') || code.includes('FLEX') || code === 'YF') return 3068000;
			return 1577000;
		} else if (cabinType === CabinType.BUSINESS) {
			if (code.includes('SM') || code === 'J' || code === 'JS') return 5022000;
			if (code.includes('FLX') || code.includes('FLEX') || code === 'JF') return 7074000;
			return 5022000;
		}
		return 0;
	}

	/**
	 * Validate availability for a flight segment
	 */
	private async validateAvailability(
		flightInstanceId: string,
		fareClass: FareClass,
		numberOfPassengers: number,
	): Promise<void> {
		const availableSeats = await this.flightSeatRepo
			.createQueryBuilder('seat')
			.innerJoin('seat.seat_config', 'config')
			.innerJoin('config.cabin_class', 'cabin')
			.where('seat.flight_instance_id = :instanceId', { instanceId: flightInstanceId })
			.andWhere('seat.is_available = :available', { available: true })
			.andWhere('cabin.cabin_class_code = :cabinCode', {
				cabinCode: fareClass.cabin_class.cabin_class_code,
			})
			.getCount();

		if (availableSeats < numberOfPassengers) {
			throw new BadRequestException(
				`Not enough available seats for flight ${flightInstanceId}. Available: ${availableSeats}, Required: ${numberOfPassengers}`,
			);
		}
	}

	/**
	 * Convert Reservation entity to ReservationResponseDto
	 */
	private entityToDto(entity: Reservation): ReservationResponseDto {
		return {
			reservationId: entity.reservation_id,
			reservationCode: entity.reservation_code,
			segments: JSON.parse(entity.segments_json),
			numberOfPassengers: entity.number_of_passengers,
			totalAmount: Number(entity.total_amount),
			currencyCode: entity.currency.currency_code,
			status: entity.status,
			expiresAt: entity.expires_at,
			ttl: Math.floor((entity.expires_at.getTime() - new Date().getTime()) / 1000),
			createdAt: entity.created_at,
			userId: entity.user?.user_id || null,
		};
	}

	/**
	 * Ensure reservation code is unique (check both Redis and Database)
	 */
	private async ensureUniqueReservationCode(code: string): Promise<string> {
		let reservationCode = code;
		let codeExists =
			(await this.redisService.exists(this.getReservationCodeKey(reservationCode))) ||
			(await this.reservationRepo.findOne({ where: { reservation_code: reservationCode } }));

		while (codeExists) {
			reservationCode = this.generateReservationCode();
			codeExists =
				(await this.redisService.exists(this.getReservationCodeKey(reservationCode))) ||
				(await this.reservationRepo.findOne({ where: { reservation_code: reservationCode } }));
		}

		return reservationCode;
	}

	/**
	 * Create reservation (Hybrid: Database + Redis)
	 * Supports multiple segments for round-trip bookings
	 * 1. Save to Database (persistent)
	 * 2. Save to Redis (cache)
	 */
	async createReservation(userId: string | null, dto: CreateReservationDto, sessionId?: string): Promise<ReservationResponseDto> {
		// Validate all segments
		const validatedSegments: Array<{
			segmentId: string;
			flightInstanceId: string;
			fareClassCode: string;
			segmentType: 'outbound' | 'inbound';
			baseFare: number;
			taxAmount: number;
			feeAmount: number;
			flightSeatId?: string | null;
			seatNumber?: string | null;
		}> = [];
		let totalAmount = 0;

		for (const segmentDto of dto.segments) {
			// Validate flight instance
			const flightInstance = await this.flightInstanceRepo.findOne({
				where: { flight_instance_id: segmentDto.flightInstanceId },
				relations: ['aircraft', 'aircraft.aircraft_type'],
			});
			if (!flightInstance) {
				throw new NotFoundException(`Flight instance ${segmentDto.flightInstanceId} not found`);
			}

			// Get cabin and seat selection from Redis (Backend manages state)
			const isGuest = !userId;
			
			// For guest users, sessionId is required
			if (isGuest && !sessionId) {
				throw new BadRequestException('Session ID is required for guest users to retrieve booking state from Redis');
			}
			
			// Get cabin and seat selection from Redis (Backend manages state)
			let cabinSelection, seatSelection, seatsArray;
			try {
				const identifier = userId || sessionId!;
				
				const selections = await this.bookingStateService.getSelectionsForReservation(
					identifier,
					segmentDto.flightInstanceId,
					isGuest,
				);
				cabinSelection = selections.cabin;
				seatSelection = selections.seat; // For backward compatibility
				seatsArray = selections.seats || []; // Array of seats for multiple passengers
			} catch (error: any) {
				// Re-throw custom booking state exceptions with context
				if (error instanceof NotFoundException || error instanceof BadRequestException) {
					// Ensure error message contains keywords that tests expect (cabin|seat|booking state)
					const errorMsg = error.message || '';
					const hasKeywords = /cabin|seat|booking state/i.test(errorMsg);
					const message = hasKeywords 
						? `Cannot create reservation: ${errorMsg}. Please select cabin and seat first using /api/v1/booking-state endpoints.`
						: `Cannot create reservation: ${errorMsg || 'Cabin and seat selection missing from booking state'}. Please select cabin and seat first using /api/v1/booking-state endpoints.`;
					throw new BadRequestException(message);
				}
				// Re-throw other exceptions as-is
				throw error;
			}

			// Validate fare class from cabin selection
			const fareClass = await this.fareClassRepo.findOne({
				where: { fare_class_code: cabinSelection.fareClassCode },
				relations: ['cabin_class'],
			});
			if (!fareClass) {
				throw new NotFoundException(`Fare class ${cabinSelection.fareClassCode} not found`);
			}

			// Determine cabin type
			const cabinType =
				fareClass.cabin_class.cabin_class_code === 'Y' ? CabinType.ECONOMY : CabinType.BUSINESS;

			// Validate and assign seat from Redis state
			const flightSeat = await this.flightSeatRepo.findOne({
				where: { flight_seat_id: seatSelection.flightSeatId },
				relations: ['seat_config', 'seat_config.cabin_class', 'flight_instance'],
			});

			if (!flightSeat) {
				throw new NotFoundException(`Flight seat ${seatSelection.flightSeatId} not found`);
			}

			// Validate seat belongs to the correct flight instance
			if (flightSeat.flight_instance_id !== segmentDto.flightInstanceId) {
				throw new BadRequestException(
					`Seat ${seatSelection.flightSeatId} does not belong to flight instance ${segmentDto.flightInstanceId}`,
				);
			}

			// Validate seat belongs to the correct cabin class
			if (flightSeat.seat_config.cabin_class.cabin_class_code !== fareClass.cabin_class.cabin_class_code) {
				throw new BadRequestException(
					`Seat ${seatSelection.flightSeatId} does not belong to cabin class ${fareClass.cabin_class.cabin_class_code}`,
				);
			}

			// Validate seat is available
			if (!flightSeat.is_available) {
				throw new BadRequestException(`Seat ${flightSeat.seat_number} is not available`);
			}

			// Mark seat as unavailable (hold the seat)
			flightSeat.is_available = false;
			await this.flightSeatRepo.save(flightSeat);

			const flightSeatId = flightSeat.flight_seat_id;
			const seatNumber = flightSeat.seat_number;

			// Calculate price
			const baseFare = this.calculateFarePrice(fareClass.fare_class_code, cabinType);
			const taxAmount = 0;
			const feeAmount = 0;
			const segmentTotal = (baseFare + taxAmount + feeAmount) * dto.numberOfPassengers;

			// Validate availability for additional passengers (if multiple passengers, validate remaining seats)
			if (dto.numberOfPassengers > 1) {
				// One seat is already selected, validate remaining seats for additional passengers
				await this.validateAvailability(segmentDto.flightInstanceId, fareClass, dto.numberOfPassengers - 1);
			}

			validatedSegments.push({
				segmentId: uuidv7(),
				flightInstanceId: segmentDto.flightInstanceId,
				fareClassCode: cabinSelection.fareClassCode,
				segmentType: segmentDto.segmentType,
				baseFare,
				taxAmount,
				feeAmount,
				flightSeatId: seatSelection.flightSeatId,
				seatNumber: seatSelection.seatNumber,
			});

			totalAmount += segmentTotal;
		}

		// Validate round-trip: if has inbound, must have outbound (one-way with only outbound is valid)
		const hasOutbound = validatedSegments.some((s) => s.segmentType === 'outbound');
		const hasInbound = validatedSegments.some((s) => s.segmentType === 'inbound');
		if (hasInbound && !hasOutbound) {
			throw new BadRequestException(
				'Round-trip reservation must include both outbound and inbound segments. Please add an outbound segment.',
			);
		}

		// Get or default currency
		const currencyCode = dto.currencyCode || 'VND';
		const currency = await this.currencyRepo.findOne({
			where: { currency_code: currencyCode },
		});
		if (!currency) {
			throw new NotFoundException(`Currency ${currencyCode} not found`);
		}

		// Generate reservation ID and code
		const reservationId = uuidv7();
		let reservationCode = this.generateReservationCode();

		// Ensure reservation code is unique (check both Redis and Database)
		reservationCode = await this.ensureUniqueReservationCode(reservationCode);

		// Create reservation data
		const now = new Date();
		const expiresAt = new Date(now.getTime() + this.reservationTtl * 1000);

		// 1. Save to Database (persistent)
		const dbReservation = this.reservationRepo.create({
			reservation_id: reservationId,
			reservation_code: reservationCode,
			user: userId ? { user_id: userId } : null,
			segments_json: JSON.stringify(validatedSegments),
			number_of_passengers: dto.numberOfPassengers,
			total_amount: totalAmount,
			currency: { currency_code: currencyCode },
			status: 'pending', // Database uses 'pending', Redis uses 'active'
			expires_at: expiresAt,
			converted_at: null,
		});
		await this.reservationRepo.save(dbReservation);

		// 2. Create DTO for Redis and response
		const reservation: ReservationResponseDto = {
			reservationId,
			reservationCode,
			segments: validatedSegments,
			numberOfPassengers: dto.numberOfPassengers,
			totalAmount,
			currencyCode,
			status: 'active', // Redis uses 'active' for active reservations
			expiresAt,
			ttl: this.reservationTtl,
			createdAt: now,
			userId: userId || null,
		};

		// 3. Store in Redis with TTL (cache)
		const reservationKey = this.getReservationKey(reservationId);
		const codeKey = this.getReservationCodeKey(reservationCode);

		await this.redisService.set(reservationKey, reservation, this.reservationTtl);
		await this.redisService.set(codeKey, reservationId, this.reservationTtl); // Map code -> id

		// 4. Clear booking state from Redis after successful reservation (cleanup)
		if (userId || sessionId) {
			const identifier = userId || sessionId!;
			const isGuestUser = !userId;
			for (const segment of validatedSegments) {
				await this.bookingStateService.clearBookingState(identifier, segment.flightInstanceId, isGuestUser);
			}
		}

		return reservation;
	}

	/**
	 * Get reservation by ID or code (Hybrid: Redis first, fallback to Database)
	 * If input is 6 characters (alphanumeric), treat as code; otherwise treat as ID
	 */
	async getReservation(reservationIdOrCode: string): Promise<ReservationResponseDto> {
		// Check if it's a code (6 alphanumeric characters) or ID (UUID v7)
		const isCode = /^[A-Z0-9]{6}$/i.test(reservationIdOrCode);

		let reservationId: string;
		if (isCode) {
			// 1. Try Redis first (fast)
			const codeKey = this.getReservationCodeKey(reservationIdOrCode);
			const id = await this.redisService.get<string>(codeKey);
			if (id) {
				reservationId = id;
			} else {
				// 2. Fallback to Database
				const dbReservation = await this.reservationRepo.findOne({
					where: { reservation_code: reservationIdOrCode },
					relations: ['user', 'currency'],
				});
				if (!dbReservation) {
					throw new NotFoundException(`Reservation code ${reservationIdOrCode} not found`);
				}
				reservationId = dbReservation.reservation_id;
			}
		} else {
			// Treat as ID
			reservationId = reservationIdOrCode;
		}

		// 1. Try Redis first (fast)
		const reservationKey = this.getReservationKey(reservationId);
		let reservation = await this.redisService.get<ReservationResponseDto>(reservationKey);

		if (reservation) {
			// BEST PRACTICE: Check expiresAt (Source of Truth) before status
			// expiresAt is the authoritative timestamp for expiration
			const now = new Date();
			const expiresAt = new Date(reservation.expiresAt);
			if (expiresAt < now) {
				// Release seats before marking as expired
				for (const segment of reservation.segments) {
					if (segment.flightSeatId) {
						await this.flightSeatRepo.update(
							{ flight_seat_id: segment.flightSeatId },
							{ is_available: true },
						);
					}
				}
				// Update status to 'expired' for consistency (optimization)
				reservation.status = 'expired';
				await this.redisService.del(reservationKey);
				const codeKey = this.getReservationCodeKey(reservation.reservationCode);
				await this.redisService.del(codeKey);
				// Update Database status for consistency
				await this.reservationRepo.update(
					{ reservation_id: reservationId },
					{ status: 'expired' },
				);
				throw new BadRequestException(
					`Reservation has expired at ${expiresAt.toISOString()}. Current time: ${now.toISOString()}.`,
				);
			}

			// Update TTL
			const ttl = await this.redisService.ttl(reservationKey);
			reservation.ttl = ttl > 0 ? ttl : 0;

			return reservation;
		}

		// 2. Fallback to Database
		const dbReservation = await this.reservationRepo.findOne({
			where: { reservation_id: reservationId },
			relations: ['user', 'currency'],
		});

		if (!dbReservation) {
			throw new NotFoundException(`Reservation ${reservationId} not found`);
		}

		// BEST PRACTICE: Check expiresAt (Source of Truth) before status
		// Update status to 'expired' if expired and still marked as 'pending' (lazy update)
		const now = new Date();
		if (dbReservation.expires_at < now && dbReservation.status === 'pending') {
			// Release seats before marking as expired
			const segments = JSON.parse(dbReservation.segments_json);
			for (const segment of segments) {
				if (segment.flightSeatId) {
					await this.flightSeatRepo.update(
						{ flight_seat_id: segment.flightSeatId },
						{ is_available: true },
					);
				}
			}
			dbReservation.status = 'expired';
			await this.reservationRepo.save(dbReservation);
		}

		// Convert to DTO
		reservation = this.entityToDto(dbReservation);

		// Optionally: Re-cache to Redis if still active
		if (reservation.status === 'pending' && reservation.expiresAt > new Date()) {
			const remainingTtl = Math.floor((reservation.expiresAt.getTime() - new Date().getTime()) / 1000);
			if (remainingTtl > 0) {
				reservation.status = 'active'; // Redis uses 'active'
				await this.redisService.set(reservationKey, reservation, remainingTtl);
				await this.redisService.set(
					this.getReservationCodeKey(reservation.reservationCode),
					reservationId,
					remainingTtl,
				);
				reservation.ttl = remainingTtl;
			}
		}

		return reservation;
	}

	/**
	 * Cancel reservation (Hybrid: Update Database + Redis)
	 * Also releases any reserved seats
	 */
	async cancelReservation(reservationId: string): Promise<{ success: boolean; message: string }> {
		const reservation = await this.getReservation(reservationId);

		if (reservation.status !== 'active' && reservation.status !== 'pending') {
			throw new BadRequestException(`Cannot cancel reservation with status: ${reservation.status}`);
		}

		// Release seats if any were reserved
		for (const segment of reservation.segments) {
			if (segment.flightSeatId) {
				await this.flightSeatRepo.update(
					{ flight_seat_id: segment.flightSeatId },
					{ is_available: true },
				);
			}
		}

		// 1. Update Database status
		await this.reservationRepo.update({ reservation_id: reservationId }, { status: 'cancelled' });

		// 2. Delete from Redis
		const reservationKey = this.getReservationKey(reservationId);
		const codeKey = this.getReservationCodeKey(reservation.reservationCode);
		await this.redisService.del(reservationKey);
		await this.redisService.del(codeKey);

		return {
			success: true,
			message: 'Reservation cancelled successfully',
		};
	}

	/**
	 * List all active reservations for a user (Hybrid: Query Database, enrich with Redis cache)
	 */
	async listReservations(userId: string): Promise<ReservationResponseDto[]> {
		// Query Database for user's active/pending reservations
		const dbReservations = await this.reservationRepo.find({
			where: {
				user: { user_id: userId },
				status: 'pending', // Only pending reservations (not expired, converted, or cancelled)
			},
			relations: ['user', 'currency'],
			order: { created_at: 'DESC' },
		});

		const reservations: ReservationResponseDto[] = [];
		const now = new Date();

		for (const dbReservation of dbReservations) {
			// Check if expired
			if (dbReservation.expires_at < now) {
				// Update status to expired
				dbReservation.status = 'expired';
				await this.reservationRepo.save(dbReservation);
				continue;
			}

			// Try to get from Redis first (faster, has TTL)
			const reservationKey = this.getReservationKey(dbReservation.reservation_id);
			let reservation = await this.redisService.get<ReservationResponseDto>(reservationKey);

			if (reservation) {
				// Use Redis data (has TTL)
				const ttl = await this.redisService.ttl(reservationKey);
				reservation.ttl = ttl > 0 ? ttl : 0;
			} else {
				// Convert from Database entity
				reservation = this.entityToDto(dbReservation);
				// Re-cache to Redis
				const remainingTtl = Math.floor((reservation.expiresAt.getTime() - now.getTime()) / 1000);
				if (remainingTtl > 0) {
					reservation.status = 'active'; // Redis uses 'active'
					await this.redisService.set(reservationKey, reservation, remainingTtl);
					await this.redisService.set(
						this.getReservationCodeKey(reservation.reservationCode),
						reservation.reservationId,
						remainingTtl,
					);
					reservation.ttl = remainingTtl;
				}
			}

			reservations.push(reservation);
		}

		return reservations;
	}

	/**
	 * Extend reservation TTL (Hybrid: Update Database + Redis)
	 */
	async extendReservation(reservationId: string, additionalSeconds: number): Promise<ReservationResponseDto> {
		const reservation = await this.getReservation(reservationId);

		if (reservation.status !== 'active' && reservation.status !== 'pending') {
			throw new BadRequestException(`Cannot extend reservation with status: ${reservation.status}`);
		}

		if (new Date(reservation.expiresAt) < new Date()) {
			throw new BadRequestException('Cannot extend expired reservation');
		}

		// Calculate new expiration time
		const newExpiresAt = new Date(new Date(reservation.expiresAt).getTime() + additionalSeconds * 1000);
		const newTtl = Math.floor((newExpiresAt.getTime() - new Date().getTime()) / 1000);

		if (newTtl <= 0) {
			throw new BadRequestException('Invalid extension time. Reservation would still be expired.');
		}

		// 1. Update Database expires_at
		await this.reservationRepo.update({ reservation_id: reservationId }, { expires_at: newExpiresAt });

		// 2. Update Redis with new TTL
		reservation.expiresAt = newExpiresAt;
		reservation.ttl = newTtl;

		const reservationKey = this.getReservationKey(reservationId);
		const codeKey = this.getReservationCodeKey(reservation.reservationCode);

		await this.redisService.set(reservationKey, reservation, newTtl);
		await this.redisService.set(codeKey, reservationId, newTtl);

		return reservation;
	}

	/**
	 * Update reservation status to 'converted' when booking is created
	 * Called by Booking Service
	 */
	async markReservationAsConverted(reservationId: string): Promise<void> {
		// Update Database
		await this.reservationRepo.update(
			{ reservation_id: reservationId },
			{ status: 'converted', converted_at: new Date() },
		);

		// Delete from Redis (no longer needed)
		const reservationKey = this.getReservationKey(reservationId);
		const reservation = await this.redisService.get<ReservationResponseDto>(reservationKey);
		if (reservation) {
			await this.redisService.del(reservationKey);
			await this.redisService.del(this.getReservationCodeKey(reservation.reservationCode));
		}
	}

	/**
	 * Cleanup expired reservations (update status to 'expired' in Database)
	 * Also releases any reserved seats
	 * Should be called periodically (e.g., via cron job or scheduled task)
	 * Returns number of reservations updated
	 */
	async cleanupExpiredReservations(): Promise<number> {
		const now = new Date();
		const expiredReservations = await this.reservationRepo.find({
			where: {
				status: 'pending',
				expires_at: LessThan(now),
			},
		});

		// Release seats for expired reservations
		for (const reservation of expiredReservations) {
			const segments = JSON.parse(reservation.segments_json);
			for (const segment of segments) {
				if (segment.flightSeatId) {
					await this.flightSeatRepo.update(
						{ flight_seat_id: segment.flightSeatId },
						{ is_available: true },
					);
				}
			}
		}

		// Update status to expired
		const result = await this.reservationRepo.update(
			{
				status: 'pending',
				expires_at: LessThan(now),
			},
			{ status: 'expired' },
		);

		return result.affected || 0;
	}
}

