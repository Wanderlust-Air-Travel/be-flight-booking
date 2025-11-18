import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { FlightInstance } from 'src/shared/entities/flight/flight-instance.entity';
import { FlightSeat } from 'src/shared/entities/flight/flight-seat.entity';
import { FareClass } from 'src/shared/entities/fare/fare-class.entity';
import { Currency } from 'src/shared/entities/currency/currency.entity';
import { RedisService } from 'src/shared/modules/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ReservationResponseDto } from './dto/reservation-response.dto';
import { CabinType } from 'src/microservices/search/dto/get-fare-options.dto';

@Injectable()
export class ReservationService {
	private readonly reservationTtl: number;

	constructor(
		@InjectRepository(FlightInstance) private readonly flightInstanceRepo: Repository<FlightInstance>,
		@InjectRepository(FlightSeat) private readonly flightSeatRepo: Repository<FlightSeat>,
		@InjectRepository(FareClass) private readonly fareClassRepo: Repository<FareClass>,
		@InjectRepository(Currency) private readonly currencyRepo: Repository<Currency>,
		private readonly redisService: RedisService,
		private readonly configService: ConfigService,
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
	 * Create reservation (store in Redis)
	 * Supports multiple segments for round-trip bookings
	 */
	async createReservation(userId: string | null, dto: CreateReservationDto): Promise<ReservationResponseDto> {
		// Validate all segments
		const validatedSegments: Array<{
			segmentId: string;
			flightInstanceId: string;
			fareClassCode: string;
			segmentType: 'outbound' | 'inbound';
			baseFare: number;
			taxAmount: number;
			feeAmount: number;
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

			// Validate fare class
			const fareClass = await this.fareClassRepo.findOne({
				where: { fare_class_code: segmentDto.fareClassCode },
				relations: ['cabin_class'],
			});
			if (!fareClass) {
				throw new NotFoundException(`Fare class ${segmentDto.fareClassCode} not found`);
			}

			// Determine cabin type
			const cabinType =
				fareClass.cabin_class.cabin_class_code === 'Y' ? CabinType.ECONOMY : CabinType.BUSINESS;

			// Calculate price
			const baseFare = this.calculateFarePrice(fareClass.fare_class_code, cabinType);
			const taxAmount = 0;
			const feeAmount = 0;
			const segmentTotal = (baseFare + taxAmount + feeAmount) * dto.numberOfPassengers;

			// Validate availability
			await this.validateAvailability(segmentDto.flightInstanceId, fareClass, dto.numberOfPassengers);

			validatedSegments.push({
				segmentId: uuidv7(),
				flightInstanceId: segmentDto.flightInstanceId,
				fareClassCode: segmentDto.fareClassCode,
				segmentType: segmentDto.segmentType,
				baseFare,
				taxAmount,
				feeAmount,
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

		// Ensure reservation code is unique
		let codeExists = await this.redisService.exists(this.getReservationCodeKey(reservationCode));
		while (codeExists) {
			reservationCode = this.generateReservationCode();
			codeExists = await this.redisService.exists(this.getReservationCodeKey(reservationCode));
		}

		// Create reservation data
		const now = new Date();
		const expiresAt = new Date(now.getTime() + this.reservationTtl * 1000);

		const reservation: ReservationResponseDto = {
			reservationId,
			reservationCode,
			segments: validatedSegments,
			numberOfPassengers: dto.numberOfPassengers,
			totalAmount,
			currencyCode,
			status: 'active',
			expiresAt,
			ttl: this.reservationTtl,
			createdAt: now,
			userId: userId || null, // Store userId for ownership validation
			// Backward compatibility fields
			flightInstanceId: validatedSegments[0]?.flightInstanceId,
			fareClassCode: validatedSegments[0]?.fareClassCode,
			baseFare: validatedSegments[0]?.baseFare,
			taxAmount: validatedSegments[0]?.taxAmount,
			feeAmount: validatedSegments[0]?.feeAmount,
		};

		// Store in Redis with TTL
		const reservationKey = this.getReservationKey(reservationId);
		const codeKey = this.getReservationCodeKey(reservationCode);

		await this.redisService.set(reservationKey, reservation, this.reservationTtl);
		await this.redisService.set(codeKey, reservationId, this.reservationTtl); // Map code -> id

		return reservation;
	}

	/**
	 * Get reservation by ID or code
	 * If input is 6 characters (alphanumeric), treat as code; otherwise treat as ID
	 */
	async getReservation(reservationIdOrCode: string): Promise<ReservationResponseDto> {
		// Check if it's a code (6 alphanumeric characters) or ID (UUID v7)
		const isCode = /^[A-Z0-9]{6}$/i.test(reservationIdOrCode);

		let reservationId: string;
		if (isCode) {
			// Lookup by code
			const codeKey = this.getReservationCodeKey(reservationIdOrCode);
			const id = await this.redisService.get<string>(codeKey);
			if (!id) {
				throw new NotFoundException(`Reservation code ${reservationIdOrCode} not found or expired`);
			}
			reservationId = id;
		} else {
			// Treat as ID
			reservationId = reservationIdOrCode;
		}

		const reservationKey = this.getReservationKey(reservationId);
		const reservation = await this.redisService.get<ReservationResponseDto>(reservationKey);

		if (!reservation) {
			throw new NotFoundException(`Reservation ${reservationId} not found or expired`);
		}

		// Check if expired
		if (new Date(reservation.expiresAt) < new Date()) {
			reservation.status = 'expired';
			await this.redisService.del(reservationKey);
			const codeKey = this.getReservationCodeKey(reservation.reservationCode);
			await this.redisService.del(codeKey);
			throw new BadRequestException('Reservation has expired');
		}

		// Update TTL
		const ttl = await this.redisService.ttl(reservationKey);
		reservation.ttl = ttl > 0 ? ttl : 0;

		return reservation;
	}

	/**
	 * Cancel reservation
	 */
	async cancelReservation(reservationId: string): Promise<{ success: boolean; message: string }> {
		const reservation = await this.getReservation(reservationId);

		if (reservation.status !== 'active') {
			throw new BadRequestException(`Cannot cancel reservation with status: ${reservation.status}`);
		}

		const reservationKey = this.getReservationKey(reservationId);
		const codeKey = this.getReservationCodeKey(reservation.reservationCode);

		// Update status to cancelled
		reservation.status = 'cancelled';
		await this.redisService.set(reservationKey, reservation, this.reservationTtl);

		// Delete code mapping
		await this.redisService.del(codeKey);

		return {
			success: true,
			message: 'Reservation cancelled successfully',
		};
	}

	/**
	 * List all active reservations for a user
	 * Note: This implementation scans all reservation keys and filters by userId.
	 * For production with large datasets, consider maintaining a separate index:
	 * `user:reservations:${userId}` -> Set of reservation IDs
	 */
	async listReservations(userId: string): Promise<ReservationResponseDto[]> {
		const reservations: ReservationResponseDto[] = [];
		const redisClient = this.redisService.getClient();

		// Get all reservation keys (format: flight-booking:reservation:*)
		// Note: RedisService uses keyPrefix, so keys() needs full pattern with prefix
		const redisConfig = this.configService.get('redis');
		const keyPrefix = redisConfig?.keyPrefix || 'flight-booking:';
		const pattern = `${keyPrefix}reservation:*`;

		const allKeys = await this.redisService.keys(pattern);

		for (const fullKey of allKeys) {
			// Extract reservation ID from full key
			// Full key format: {prefix}reservation:{id}
			const reservationId = fullKey.replace(`${keyPrefix}reservation:`, '');
			const reservation = await this.redisService.get<ReservationResponseDto>(reservationId);

			if (reservation && reservation.userId === userId && reservation.status === 'active') {
				// Check if not expired
				if (new Date(reservation.expiresAt) >= new Date()) {
					// Update TTL
					const ttl = await this.redisService.ttl(reservationId);
					reservation.ttl = ttl > 0 ? ttl : 0;
					reservations.push(reservation);
				}
			}
		}

		return reservations;
	}

	/**
	 * Extend reservation TTL
	 */
	async extendReservation(reservationId: string, additionalSeconds: number): Promise<ReservationResponseDto> {
		const reservation = await this.getReservation(reservationId);

		if (reservation.status !== 'active') {
			throw new BadRequestException(`Cannot extend reservation with status: ${reservation.status}`);
		}

		if (new Date(reservation.expiresAt) < new Date()) {
			throw new BadRequestException('Cannot extend expired reservation');
		}

		const reservationKey = this.getReservationKey(reservationId);
		const codeKey = this.getReservationCodeKey(reservation.reservationCode);

		// Calculate new expiration time
		const newExpiresAt = new Date(new Date(reservation.expiresAt).getTime() + additionalSeconds * 1000);
		const newTtl = Math.floor((newExpiresAt.getTime() - new Date().getTime()) / 1000);

		if (newTtl <= 0) {
			throw new BadRequestException('Invalid extension time. Reservation would still be expired.');
		}

		// Update reservation with new expiration
		reservation.expiresAt = newExpiresAt;
		reservation.ttl = newTtl;

		// Update Redis with new TTL
		await this.redisService.set(reservationKey, reservation, newTtl);
		await this.redisService.set(codeKey, reservationId, newTtl);

		return reservation;
	}
}

