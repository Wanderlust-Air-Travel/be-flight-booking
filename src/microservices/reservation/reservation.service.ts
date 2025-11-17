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
	 * Create reservation (store in Redis)
	 */
	async createReservation(userId: string | null, dto: CreateReservationDto): Promise<ReservationResponseDto> {
		// Validate flight instance
		const flightInstance = await this.flightInstanceRepo.findOne({
			where: { flight_instance_id: dto.flightInstanceId },
			relations: ['aircraft', 'aircraft.aircraft_type'],
		});
		if (!flightInstance) {
			throw new NotFoundException(`Flight instance ${dto.flightInstanceId} not found`);
		}

		// Validate fare class
		const fareClass = await this.fareClassRepo.findOne({
			where: { fare_class_code: dto.fareClassCode },
			relations: ['cabin_class'],
		});
		if (!fareClass) {
			throw new NotFoundException(`Fare class ${dto.fareClassCode} not found`);
		}

		// Determine cabin type
		const cabinType =
			fareClass.cabin_class.cabin_class_code === 'Y' ? CabinType.ECONOMY : CabinType.BUSINESS;

		// Calculate price
		const baseFare = this.calculateFarePrice(fareClass.fare_class_code, cabinType);
		const taxAmount = 0;
		const feeAmount = 0;
		const totalAmount = baseFare * dto.numberOfPassengers + taxAmount + feeAmount;

		// Validate availability
		const availableSeats = await this.flightSeatRepo
			.createQueryBuilder('seat')
			.innerJoin('seat.seat_config', 'config')
			.innerJoin('config.cabin_class', 'cabin')
			.where('seat.flight_instance_id = :instanceId', { instanceId: dto.flightInstanceId })
			.andWhere('seat.is_available = :available', { available: true })
			.andWhere('cabin.cabin_class_code = :cabinCode', {
				cabinCode: fareClass.cabin_class.cabin_class_code,
			})
			.getCount();

		if (availableSeats < dto.numberOfPassengers) {
			throw new BadRequestException(
				`Not enough available seats. Available: ${availableSeats}, Required: ${dto.numberOfPassengers}`,
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
			flightInstanceId: dto.flightInstanceId,
			fareClassCode: dto.fareClassCode,
			numberOfPassengers: dto.numberOfPassengers,
			baseFare,
			taxAmount,
			feeAmount,
			totalAmount,
			currencyCode,
			status: 'active',
			expiresAt,
			ttl: this.reservationTtl,
			createdAt: now,
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
}

