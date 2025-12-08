import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { FareClass } from 'src/shared/entities/fare/fare-class.entity';
import { CabinClass } from 'src/shared/entities/cabin/cabin-class.entity';
import { FlightSchedule } from 'src/shared/entities/flight/flight-schedule.entity';
import { FlightInstance } from 'src/shared/entities/flight/flight-instance.entity';
import { Route } from 'src/shared/entities/route/route.entity';
import { AircraftType } from 'src/shared/entities/aircraft/aircraft-type.entity';
import { Aircraft } from 'src/shared/entities/aircraft/aircraft.entity';
import { FlightSeat } from 'src/shared/entities/flight/flight-seat.entity';
import { SeatConfiguration } from 'src/shared/entities/seat/seat-configuration.entity';
import { User } from 'src/shared/entities/user/user.entity';
import { UserRole } from 'src/shared/entities/user/user-role.entity';
import { Role } from 'src/shared/entities/role/role.entity';
import { RouteFarePrice } from 'src/shared/entities/fare/route-fare-price.entity';
import { BaggageAllowance } from 'src/shared/entities/fare/baggage-allowance.entity';
import { CabinService } from 'src/shared/entities/cabin/cabin-service.entity';
import { FareDescriptionRule } from 'src/shared/entities/fare/fare-description-rule.entity';
import { CreateFareClassDto } from './dto/create-fare-class.dto';
import { CreateRouteFarePriceDto } from './dto/create-route-fare-price.dto';
import { UpdateRouteFarePriceDto } from './dto/update-route-fare-price.dto';
import { GetRouteFarePricesDto } from './dto/get-route-fare-prices.dto';
import { GetBaggageAllowancesDto } from './dto/get-baggage-allowances.dto';
import { BaggageAllowancesResponseDto } from './dto/baggage-allowances-response.dto';
import { RouteFarePricesResponseDto } from './dto/route-fare-prices-response.dto';
import { CreateBaggageAllowanceDto } from './dto/create-baggage-allowance.dto';
import { UpdateBaggageAllowanceDto } from './dto/update-baggage-allowance.dto';
import { CreateCabinServiceDto } from './dto/create-cabin-service.dto';
import { UpdateCabinServiceDto } from './dto/update-cabin-service.dto';
import { UpdateFareClassDto } from './dto/update-fare-class.dto';
import { CreateFareDescriptionRuleDto } from './dto/create-fare-description-rule.dto';
import { UpdateFareDescriptionRuleDto } from './dto/update-fare-description-rule.dto';
import { CreateFlightScheduleDto } from './dto/create-flight-schedule.dto';
import { UpdateFlightScheduleDto } from './dto/update-flight-schedule.dto';
import { FlightScheduleResponseDto } from './dto/flight-schedule-response.dto';
import { CreateFlightInstanceDto } from './dto/create-flight-instance.dto';
import { UpdateFlightInstanceDto } from './dto/update-flight-instance.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { RemoveRoleDto } from './dto/remove-role.dto';
import { SystemRole } from 'src/shared/constants/roles';
import { randomUUID } from 'crypto';

@Injectable()
export class AdminService {
	private readonly logger = new Logger(AdminService.name);

	constructor(
		@InjectRepository(FareClass) private readonly fareClassRepo: Repository<FareClass>,
		@InjectRepository(CabinClass) private readonly cabinClassRepo: Repository<CabinClass>,
		@InjectRepository(FlightSchedule) private readonly flightScheduleRepo: Repository<FlightSchedule>,
		@InjectRepository(FlightInstance) private readonly flightInstanceRepo: Repository<FlightInstance>,
		@InjectRepository(Route) private readonly routeRepo: Repository<Route>,
		@InjectRepository(AircraftType) private readonly aircraftTypeRepo: Repository<AircraftType>,
		@InjectRepository(Aircraft) private readonly aircraftRepo: Repository<Aircraft>,
		@InjectRepository(FlightSeat) private readonly flightSeatRepo: Repository<FlightSeat>,
		@InjectRepository(SeatConfiguration) private readonly seatConfigRepo: Repository<SeatConfiguration>,
		@InjectRepository(User) private readonly userRepo: Repository<User>,
		@InjectRepository(UserRole) private readonly userRoleRepo: Repository<UserRole>,
		@InjectRepository(Role) private readonly roleRepo: Repository<Role>,
		@InjectRepository(RouteFarePrice) private readonly routeFarePriceRepo: Repository<RouteFarePrice>,
		@InjectRepository(BaggageAllowance) private readonly baggageAllowanceRepo: Repository<BaggageAllowance>,
		@InjectRepository(CabinService) private readonly cabinServiceRepo: Repository<CabinService>,
		@InjectRepository(FareDescriptionRule) private readonly fareDescriptionRuleRepo: Repository<FareDescriptionRule>,
		private readonly dataSource: DataSource,
	) {}

	// ==================== FARE MANAGEMENT ====================

	/**
	 * Create a new fare class
	 */
	async createFareClass(dto: CreateFareClassDto): Promise<FareClass> {
		// Validate cabin class exists
		const cabinClass = await this.cabinClassRepo.findOne({
			where: { cabin_class_code: dto.cabinClassCode },
		});

		if (!cabinClass) {
			throw new NotFoundException(`Cabin class ${dto.cabinClassCode} not found`);
		}

		// Check if fare class already exists
		const existing = await this.fareClassRepo.findOne({
			where: { fare_class_code: dto.fareClassCode },
		});

		if (existing) {
			throw new BadRequestException(`Fare class ${dto.fareClassCode} already exists`);
		}

		// Create fare class
		const fareClass = this.fareClassRepo.create({
			fare_class_code: dto.fareClassCode,
			cabin_class: cabinClass,
			description: dto.description || null,
			change_rule: dto.changeRule || null,
			refund_rule: dto.refundRule || null,
		});

		const savedFareClass = await this.fareClassRepo.save(fareClass);
		
		// Reload with relations to ensure complete data
		return await this.fareClassRepo.findOne({
			where: { fare_class_code: savedFareClass.fare_class_code },
			relations: ['cabin_class'],
		}) || savedFareClass;
	}

	/**
	 * Get all fare classes
	 */
	async getAllFareClasses(): Promise<FareClass[]> {
		return await this.fareClassRepo.find({
			relations: ['cabin_class'],
			order: { fare_class_code: 'ASC' },
		});
	}

	/**
	 * Get fare class by code
	 */
	async getFareClassByCode(fareClassCode: string): Promise<FareClass> {
		const fareClass = await this.fareClassRepo.findOne({
			where: { fare_class_code: fareClassCode },
			relations: ['cabin_class'],
		});

		if (!fareClass) {
			throw new NotFoundException(`Fare class ${fareClassCode} not found`);
		}

		return fareClass;
	}

	/**
	 * Update fare class
	 */
	async updateFareClass(fareClassCode: string, dto: UpdateFareClassDto): Promise<FareClass> {
		const fareClass = await this.fareClassRepo.findOne({
			where: { fare_class_code: fareClassCode },
		});

		if (!fareClass) {
			throw new NotFoundException(`Fare class ${fareClassCode} not found`);
		}

		if (dto.description !== undefined) {
			fareClass.description = dto.description;
		}
		if (dto.changeRule !== undefined) {
			fareClass.change_rule = dto.changeRule;
		}
		if (dto.refundRule !== undefined) {
			fareClass.refund_rule = dto.refundRule;
		}

		return await this.fareClassRepo.save(fareClass);
	}

	/**
	 * Delete fare class
	 */
	async deleteFareClass(fareClassCode: string): Promise<{ success: boolean; message: string }> {
		const fareClass = await this.fareClassRepo.findOne({
			where: { fare_class_code: fareClassCode },
			relations: ['cabin_class'],
		});

		if (!fareClass) {
			throw new NotFoundException(`Fare class ${fareClassCode} not found`);
		}

		// Check if fare class is being used in bookings
		// (In production, you might want to check for active bookings)
		
		await this.fareClassRepo.remove(fareClass);

		return {
			success: true,
			message: `Fare class ${fareClassCode} deleted successfully`,
		};
	}

	// ==================== FLIGHT SCHEDULE MANAGEMENT ====================

	/**
	 * Transform FlightSchedule entity to Response DTO
	 */
	private transformFlightScheduleToDto(schedule: FlightSchedule): FlightScheduleResponseDto {
		return {
			flightScheduleId: schedule.flight_schedule_id,
			flightNumber: schedule.flight_number,
			routeId: schedule.route_id,
			route: schedule.route
				? {
						routeId: schedule.route.route_id,
						originAirport: schedule.route.origin_airport
							? {
									airportId: schedule.route.origin_airport.airport_id,
									iataCode: schedule.route.origin_airport.iata_code,
									icaoCode: schedule.route.origin_airport.icao_code,
									name: schedule.route.origin_airport.name,
									city: schedule.route.origin_airport.city,
									country: schedule.route.origin_airport.country,
									timezone: schedule.route.origin_airport.timezone,
								}
							: undefined,
						destinationAirport: schedule.route.destination_airport
							? {
									airportId: schedule.route.destination_airport.airport_id,
									iataCode: schedule.route.destination_airport.iata_code,
									icaoCode: schedule.route.destination_airport.icao_code,
									name: schedule.route.destination_airport.name,
									city: schedule.route.destination_airport.city,
									country: schedule.route.destination_airport.country,
									timezone: schedule.route.destination_airport.timezone,
								}
							: undefined,
						distanceKm: schedule.route.distance_km,
						isDomestic: schedule.route.is_domestic,
					}
				: undefined,
			aircraftTypeId: schedule.aircraft_type_id,
			aircraftType: schedule.aircraft_type
				? {
						aircraftTypeId: schedule.aircraft_type.aircraft_type_id,
						code: schedule.aircraft_type.code,
						manufacturer: schedule.aircraft_type.manufacturer,
						model: schedule.aircraft_type.model,
						totalSeats: schedule.aircraft_type.total_seats,
					}
				: undefined,
			departureTime: schedule.departure_time_local,
			arrivalTime: schedule.arrival_time_local,
			operatingDays: schedule.operating_days,
			effectiveFrom: schedule.effective_from,
			effectiveTo: schedule.effective_to,
			status: schedule.status,
		};
	}

	/**
	 * Create a new flight schedule
	 */
	async createFlightSchedule(dto: CreateFlightScheduleDto): Promise<FlightScheduleResponseDto> {
		// Validate route exists
		const route = await this.routeRepo.findOne({
			where: { route_id: dto.routeId },
		});

		if (!route) {
			throw new NotFoundException(`Route ${dto.routeId} not found`);
		}

		// Validate aircraft type exists
		const aircraftType = await this.aircraftTypeRepo.findOne({
			where: { aircraft_type_id: dto.aircraftTypeId },
		});

		if (!aircraftType) {
			throw new NotFoundException(`Aircraft type ${dto.aircraftTypeId} not found`);
		}

		// Validate date range
		const effectiveFrom = new Date(dto.effectiveFrom);
		const effectiveTo = new Date(dto.effectiveTo);

		if (effectiveFrom >= effectiveTo) {
			throw new BadRequestException('effectiveFrom must be before effectiveTo');
		}

		// Check for overlapping schedules with same flight number
		const overlapping = await this.flightScheduleRepo
			.createQueryBuilder('schedule')
			.where('schedule.flight_number = :flightNumber', { flightNumber: dto.flightNumber })
			.andWhere('schedule.status = :status', { status: 'active' })
			.andWhere(
				'(schedule.effective_from <= :effectiveTo AND schedule.effective_to >= :effectiveFrom)',
				{ effectiveFrom, effectiveTo },
			)
			.getOne();

		if (overlapping) {
			throw new BadRequestException(
				`Flight schedule ${dto.flightNumber} already exists for the specified date range`,
			);
		}

		// Create flight schedule
		const flightSchedule = this.flightScheduleRepo.create({
			flight_schedule_id: randomUUID(),
			flight_number: dto.flightNumber,
			route: route,
			aircraft_type: aircraftType,
			departure_time_local: dto.departureTime,
			arrival_time_local: dto.arrivalTime,
			operating_days: dto.operatingDays,
			effective_from: effectiveFrom,
			effective_to: effectiveTo,
			status: dto.status || 'active',
		});

		const savedSchedule = await this.flightScheduleRepo.save(flightSchedule);

		// Reload with relations to return complete data
		const scheduleWithRelations = await this.flightScheduleRepo.findOne({
			where: { flight_schedule_id: savedSchedule.flight_schedule_id },
			relations: ['route', 'route.origin_airport', 'route.destination_airport', 'aircraft_type'],
		});

		return this.transformFlightScheduleToDto(scheduleWithRelations!);
	}

	/**
	 * Get all flight schedules
	 */
	async getAllFlightSchedules(): Promise<FlightScheduleResponseDto[]> {
		const schedules = await this.flightScheduleRepo.find({
			relations: ['route', 'route.origin_airport', 'route.destination_airport', 'aircraft_type'],
			order: { flight_number: 'ASC', effective_from: 'DESC' },
		});

		return schedules.map((schedule) => this.transformFlightScheduleToDto(schedule));
	}

	/**
	 * Get flight schedule by ID
	 */
	async getFlightScheduleById(flightScheduleId: string): Promise<FlightScheduleResponseDto> {
		const schedule = await this.flightScheduleRepo.findOne({
			where: { flight_schedule_id: flightScheduleId },
			relations: ['route', 'route.origin_airport', 'route.destination_airport', 'aircraft_type'],
		});

		if (!schedule) {
			throw new NotFoundException(`Flight schedule ${flightScheduleId} not found`);
		}

		return this.transformFlightScheduleToDto(schedule);
	}

	/**
	 * Update flight schedule
	 */
	async updateFlightSchedule(flightScheduleId: string, dto: UpdateFlightScheduleDto): Promise<FlightScheduleResponseDto> {
		const schedule = await this.flightScheduleRepo.findOne({
			where: { flight_schedule_id: flightScheduleId },
		});

		if (!schedule) {
			throw new NotFoundException(`Flight schedule ${flightScheduleId} not found`);
		}

		if (dto.departureTime !== undefined) {
			schedule.departure_time_local = dto.departureTime;
		}
		if (dto.arrivalTime !== undefined) {
			schedule.arrival_time_local = dto.arrivalTime;
		}
		if (dto.operatingDays !== undefined) {
			schedule.operating_days = dto.operatingDays;
		}
		if (dto.effectiveFrom !== undefined) {
			schedule.effective_from = new Date(dto.effectiveFrom);
		}
		if (dto.effectiveTo !== undefined) {
			schedule.effective_to = new Date(dto.effectiveTo);
		}
		if (dto.status !== undefined) {
			schedule.status = dto.status;
		}

		// Validate date range if both dates are updated
		if (dto.effectiveFrom !== undefined || dto.effectiveTo !== undefined) {
			if (schedule.effective_from >= schedule.effective_to) {
				throw new BadRequestException('effectiveFrom must be before effectiveTo');
			}
		}

		await this.flightScheduleRepo.save(schedule);

		// Reload with relations to return complete data
		const updatedSchedule = await this.flightScheduleRepo.findOne({
			where: { flight_schedule_id: flightScheduleId },
			relations: ['route', 'route.origin_airport', 'route.destination_airport', 'aircraft_type'],
		});

		return this.transformFlightScheduleToDto(updatedSchedule!);
	}

	/**
	 * Delete flight schedule
	 */
	async deleteFlightSchedule(flightScheduleId: string): Promise<{ success: boolean; message: string }> {
		const schedule = await this.flightScheduleRepo.findOne({
			where: { flight_schedule_id: flightScheduleId },
		});

		if (!schedule) {
			throw new NotFoundException(`Flight schedule ${flightScheduleId} not found`);
		}

		// Check if schedule has flight instances
		const instances = await this.flightInstanceRepo.count({
			where: { flight_schedule_id: flightScheduleId },
		});

		if (instances > 0) {
			throw new BadRequestException(
				`Cannot delete flight schedule with ${instances} existing flight instance(s). Please delete or update instances first.`,
			);
		}

		await this.flightScheduleRepo.remove(schedule);

		return {
			success: true,
			message: `Flight schedule ${flightScheduleId} deleted successfully`,
		};
	}

	// ==================== FLIGHT INSTANCE MANAGEMENT ====================

	/**
	 * Create a new flight instance
	 */
	async createFlightInstance(dto: CreateFlightInstanceDto): Promise<FlightInstance> {
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			// Validate flight schedule exists
			const schedule = await queryRunner.manager.findOne(FlightSchedule, {
				where: { flight_schedule_id: dto.flightScheduleId },
				relations: ['route', 'aircraft_type'],
			});

			if (!schedule) {
				throw new NotFoundException(`Flight schedule ${dto.flightScheduleId} not found`);
			}

			// Validate flight date is within schedule's effective period
			const flightDate = new Date(dto.flightDate);
			if (flightDate < schedule.effective_from || flightDate > schedule.effective_to) {
				throw new BadRequestException(
					`Flight date ${dto.flightDate} is outside schedule's effective period (${schedule.effective_from.toISOString().split('T')[0]} to ${schedule.effective_to.toISOString().split('T')[0]})`,
				);
			}

			// Check if instance already exists for this flight number and date
			const existing = await queryRunner.manager.findOne(FlightInstance, {
				where: {
					flight_number: schedule.flight_number,
					flight_date: flightDate,
				},
			});

			if (existing) {
				throw new BadRequestException(
					`Flight instance already exists for ${schedule.flight_number} on ${dto.flightDate}`,
				);
			}

			// Get or assign aircraft
			let aircraft: Aircraft | null = null;
			if (dto.aircraftId) {
				aircraft = await queryRunner.manager.findOne(Aircraft, {
					where: { aircraft_id: dto.aircraftId },
					relations: ['aircraft_type'],
				});

				if (!aircraft) {
					throw new NotFoundException(`Aircraft ${dto.aircraftId} not found`);
				}

				// Validate aircraft type matches schedule
				if (aircraft.aircraft_type.aircraft_type_id !== schedule.aircraft_type.aircraft_type_id) {
					throw new BadRequestException(
						`Aircraft type ${aircraft.aircraft_type.aircraft_type_id} does not match schedule's aircraft type ${schedule.aircraft_type.aircraft_type_id}`,
					);
				}
			} else {
				// Auto-assign available aircraft of matching type
				const availableAircraft = await queryRunner.manager.find(Aircraft, {
					where: {
						aircraft_type: { aircraft_type_id: schedule.aircraft_type.aircraft_type_id },
						in_service: true,
					},
					relations: ['aircraft_type'],
				});

				if (availableAircraft.length === 0) {
					throw new BadRequestException(
						`No available aircraft of type ${schedule.aircraft_type.code} found`,
					);
				}

				// Use first available aircraft (in production, you might want more sophisticated assignment)
				aircraft = availableAircraft[0];
			}

			// Calculate departure and arrival datetimes
			const [depHour, depMin] = schedule.departure_time_local.split(':').map(Number);
			const [arrHour, arrMin] = schedule.arrival_time_local.split(':').map(Number);

			const departure = new Date(flightDate);
			departure.setHours(depHour, depMin, 0, 0);

			const arrival = new Date(flightDate);
			arrival.setHours(arrHour, arrMin, 0, 0);
			if (arrival < departure) {
				arrival.setDate(arrival.getDate() + 1); // Next day arrival
			}

			// Create flight instance
			const flightInstance = queryRunner.manager.create(FlightInstance, {
				flight_instance_id: randomUUID(),
				flight_schedule: schedule,
				flight_date: flightDate,
				flight_number: schedule.flight_number,
				aircraft: aircraft,
				departure_datetime_local: departure,
				arrival_datetime_local: arrival,
				status: dto.status || 'scheduled',
			});

			const savedInstance = await queryRunner.manager.save(flightInstance);

			// Create flight seats for this instance
			const seatConfigs = await queryRunner.manager
				.createQueryBuilder(SeatConfiguration, 'sc')
				.innerJoinAndSelect('sc.cabin_class', 'cabin')
				.where('sc.aircraft_type_id = :aircraftTypeId', {
					aircraftTypeId: schedule.aircraft_type.aircraft_type_id,
				})
				.getMany();

			// Batch create flight seats
			const flightSeats = seatConfigs.map((seatConfig) =>
				queryRunner.manager.create(FlightSeat, {
					flight_seat_id: randomUUID(),
					flight_instance: savedInstance,
					seat_config: seatConfig,
					seat_number: seatConfig.seat_number,
					is_available: true,
				}),
			);

			// Insert in batches to avoid SQL Server parameter limit
			const batchSize = 1000;
			for (let i = 0; i < flightSeats.length; i += batchSize) {
				const batch = flightSeats.slice(i, i + batchSize);
				await queryRunner.manager.save(FlightSeat, batch);
			}

			await queryRunner.commitTransaction();

			// Reload with relations
			return await this.flightInstanceRepo.findOne({
				where: { flight_instance_id: savedInstance.flight_instance_id },
				relations: ['flight_schedule', 'aircraft', 'aircraft.aircraft_type'],
			}) as FlightInstance;
		} catch (error: any) {
			await queryRunner.rollbackTransaction();
			this.logger.error('Error creating flight instance:', error);
			throw error;
		} finally {
			await queryRunner.release();
		}
	}

	/**
	 * Get all flight instances
	 */
	async getAllFlightInstances(): Promise<FlightInstance[]> {
		return await this.flightInstanceRepo.find({
			relations: ['flight_schedule', 'flight_schedule.route', 'aircraft', 'aircraft.aircraft_type'],
			order: { flight_date: 'DESC', departure_datetime_local: 'ASC' },
		});
	}

	/**
	 * Get flight instance by ID
	 */
	async getFlightInstanceById(flightInstanceId: string): Promise<FlightInstance> {
		const instance = await this.flightInstanceRepo.findOne({
			where: { flight_instance_id: flightInstanceId },
			relations: [
				'flight_schedule',
				'flight_schedule.route',
				'flight_schedule.route.origin_airport',
				'flight_schedule.route.destination_airport',
				'aircraft',
				'aircraft.aircraft_type',
			],
		});

		if (!instance) {
			throw new NotFoundException(`Flight instance ${flightInstanceId} not found`);
		}

		return instance;
	}

	/**
	 * Update flight instance
	 */
	async updateFlightInstance(flightInstanceId: string, dto: UpdateFlightInstanceDto): Promise<FlightInstance> {
		const instance = await this.flightInstanceRepo.findOne({
			where: { flight_instance_id: flightInstanceId },
			relations: ['flight_schedule', 'aircraft', 'aircraft.aircraft_type'],
		});

		if (!instance) {
			throw new NotFoundException(`Flight instance ${flightInstanceId} not found`);
		}

		if (dto.aircraftId !== undefined) {
			const aircraft = await this.aircraftRepo.findOne({
				where: { aircraft_id: dto.aircraftId },
				relations: ['aircraft_type'],
			});

			if (!aircraft) {
				throw new NotFoundException(`Aircraft ${dto.aircraftId} not found`);
			}

			// Validate aircraft type matches schedule
			if (aircraft.aircraft_type.aircraft_type_id !== instance.flight_schedule.aircraft_type.aircraft_type_id) {
				throw new BadRequestException(
					`Aircraft type does not match schedule's aircraft type`,
				);
			}

			instance.aircraft = aircraft;
		}

		if (dto.departureDateTime !== undefined) {
			instance.departure_datetime_local = new Date(dto.departureDateTime);
		}

		if (dto.arrivalDateTime !== undefined) {
			instance.arrival_datetime_local = new Date(dto.arrivalDateTime);
		}

		if (dto.status !== undefined) {
			instance.status = dto.status;
		}

		return await this.flightInstanceRepo.save(instance);
	}

	/**
	 * Delete flight instance
	 */
	async deleteFlightInstance(flightInstanceId: string): Promise<{ success: boolean; message: string }> {
		const instance = await this.flightInstanceRepo.findOne({
			where: { flight_instance_id: flightInstanceId },
		});

		if (!instance) {
			throw new NotFoundException(`Flight instance ${flightInstanceId} not found`);
		}

		// Check if instance has bookings
		// (In production, you might want to check for active bookings)

		await this.flightInstanceRepo.remove(instance);

		return {
			success: true,
			message: `Flight instance ${flightInstanceId} deleted successfully`,
		};
	}

	// ==================== USER ROLE MANAGEMENT ====================

	/**
	 * Assign role to user
	 */
	async assignRoleToUser(dto: AssignRoleDto): Promise<{ success: boolean; message: string }> {
		// Validate user exists
		const user = await this.userRepo.findOne({
			where: { user_id: dto.userId },
		});

		if (!user) {
			throw new NotFoundException(`User ${dto.userId} not found`);
		}

		// Validate role exists
		const role = await this.roleRepo.findOne({
			where: { role_code: dto.roleCode },
		});

		if (!role) {
			throw new NotFoundException(`Role ${dto.roleCode} not found`);
		}

		// Check if user already has this role
		const existing = await this.userRoleRepo.findOne({
			where: {
				user_id: dto.userId,
				role_code: dto.roleCode,
			},
		});

		if (existing) {
			throw new BadRequestException(`User ${dto.userId} already has role ${dto.roleCode}`);
		}

		// Assign role
		const userRole = this.userRoleRepo.create({
			user_id: dto.userId,
			role_code: dto.roleCode,
		});

		await this.userRoleRepo.save(userRole);

		return {
			success: true,
			message: `Role ${dto.roleCode} assigned to user ${dto.userId} successfully`,
		};
	}

	/**
	 * Remove role from user
	 */
	async removeRoleFromUser(dto: RemoveRoleDto): Promise<{ success: boolean; message: string }> {
		// Validate user exists
		const user = await this.userRepo.findOne({
			where: { user_id: dto.userId },
		});

		if (!user) {
			throw new NotFoundException(`User ${dto.userId} not found`);
		}

		// Prevent removing CUSTOMER role (everyone should have at least CUSTOMER role)
		if (dto.roleCode === SystemRole.CUSTOMER) {
			throw new BadRequestException('Cannot remove CUSTOMER role. All users must have CUSTOMER role.');
		}

		// Find and remove role
		const userRole = await this.userRoleRepo.findOne({
			where: {
				user_id: dto.userId,
				role_code: dto.roleCode,
			},
		});

		if (!userRole) {
			throw new NotFoundException(`User ${dto.userId} does not have role ${dto.roleCode}`);
		}

		await this.userRoleRepo.remove(userRole);

		return {
			success: true,
			message: `Role ${dto.roleCode} removed from user ${dto.userId} successfully`,
		};
	}

	/**
	 * Get user roles
	 */
	async getUserRoles(userId: string): Promise<Role[]> {
		const user = await this.userRepo.findOne({
			where: { user_id: userId },
			relations: ['userRoles', 'userRoles.role'],
		});

		if (!user) {
			throw new NotFoundException(`User ${userId} not found`);
		}

		return user.userRoles.map(ur => ur.role).filter((role): role is Role => !!role);
	}

	/**
	 * Get all roles
	 */
	async getAllRoles(): Promise<Role[]> {
		return await this.roleRepo.find({
			where: { is_active: true },
			order: { role_code: 'ASC' },
		});
	}

	/**
	 * Get all users with their roles
	 */
	async getAllUsers(): Promise<User[]> {
		return await this.userRepo.find({
			relations: ['userRoles', 'userRoles.role'],
			order: { created_at: 'DESC' },
		});
	}

	/**
	 * Get all routes with airports
	 */
	async getAllRoutes(): Promise<Route[]> {
		return await this.routeRepo.find({
			relations: ['origin_airport', 'destination_airport'],
			order: { created_at: 'DESC' },
		});
	}

	// ==================== ROUTE FARE PRICE MANAGEMENT (REVENUE_ANALYST) ====================

	/**
	 * Create a new route fare price
	 */
	async createRouteFarePrice(dto: CreateRouteFarePriceDto): Promise<RouteFarePrice> {
		// Validate route exists
		const route = await this.routeRepo.findOne({
			where: { route_id: dto.routeId },
		});

		if (!route) {
			throw new NotFoundException(`Route ${dto.routeId} not found`);
		}

		// Validate fare class exists
		const fareClass = await this.fareClassRepo.findOne({
			where: { fare_class_code: dto.fareClassCode },
		});

		if (!fareClass) {
			throw new NotFoundException(`Fare class ${dto.fareClassCode} not found`);
		}

		// Create route fare price
		const routeFarePrice = this.routeFarePriceRepo.create({
			route_fare_price_id: randomUUID(),
			route_id: dto.routeId,
			fare_class_code: dto.fareClassCode,
			base_price: dto.basePrice,
			tax_rate: dto.taxRate ?? 0.1,
			fee_rate: dto.feeRate ?? 0.05,
			effective_from: new Date(dto.effectiveFrom),
			effective_to: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
			is_active: dto.isActive ?? true,
			priority: dto.priority ?? 0,
			notes: dto.notes || null,
		});

		return await this.routeFarePriceRepo.save(routeFarePrice);
	}

	/**
	 * Get all route fare prices with pagination
	 */
	async getAllRouteFarePrices(dto: GetRouteFarePricesDto = { page: 1, limit: 20 }): Promise<RouteFarePricesResponseDto> {
		// Ensure page and limit are numbers - handle both string and number inputs
		const page = dto.page ? Number(dto.page) : 1;
		let limit = dto.limit ? Number(dto.limit) : 20;
		
		// Validate limit is one of allowed values
		const allowedLimits = [20, 50, 100, 200];
		if (!allowedLimits.includes(limit)) {
			limit = 20;
		}
		
		const validLimit = limit;
		const skip = (page - 1) * validLimit;

		// Get total count and paginated results
		const [routeFarePrices, totalItems] = await this.routeFarePriceRepo.findAndCount({
			relations: [
				'route',
				'route.origin_airport',
				'route.destination_airport',
				'fare_class',
			],
			order: { created_at: 'DESC' },
			skip,
			take: validLimit,
		});

		const totalPages = Math.ceil(totalItems / validLimit);

		return {
			data: routeFarePrices,
			currentPage: page,
			pageSize: validLimit,
			totalItems,
			totalPages,
			hasNextPage: page < totalPages,
			hasPreviousPage: page > 1,
		};
	}

	/**
	 * Get route fare price by ID
	 */
	async getRouteFarePriceById(routeFarePriceId: string): Promise<RouteFarePrice> {
		const routeFarePrice = await this.routeFarePriceRepo.findOne({
			where: { route_fare_price_id: routeFarePriceId },
			relations: [
				'route',
				'route.origin_airport',
				'route.destination_airport',
				'fare_class',
			],
		});

		if (!routeFarePrice) {
			throw new NotFoundException(`Route fare price ${routeFarePriceId} not found`);
		}

		return routeFarePrice;
	}

	/**
	 * Update route fare price
	 */
	async updateRouteFarePrice(
		routeFarePriceId: string,
		dto: UpdateRouteFarePriceDto,
	): Promise<RouteFarePrice> {
		const routeFarePrice = await this.routeFarePriceRepo.findOne({
			where: { route_fare_price_id: routeFarePriceId },
		});

		if (!routeFarePrice) {
			throw new NotFoundException(`Route fare price ${routeFarePriceId} not found`);
		}

		// Update fields
		if (dto.basePrice !== undefined) routeFarePrice.base_price = dto.basePrice;
		if (dto.taxRate !== undefined) routeFarePrice.tax_rate = dto.taxRate;
		if (dto.feeRate !== undefined) routeFarePrice.fee_rate = dto.feeRate;
		if (dto.effectiveFrom !== undefined) routeFarePrice.effective_from = new Date(dto.effectiveFrom);
		if (dto.effectiveTo !== undefined) routeFarePrice.effective_to = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
		if (dto.isActive !== undefined) routeFarePrice.is_active = dto.isActive;
		if (dto.priority !== undefined) routeFarePrice.priority = dto.priority;
		if (dto.notes !== undefined) routeFarePrice.notes = dto.notes;

		routeFarePrice.updated_at = new Date();

		return await this.routeFarePriceRepo.save(routeFarePrice);
	}

	/**
	 * Delete route fare price
	 */
	async deleteRouteFarePrice(routeFarePriceId: string): Promise<{ success: boolean; message: string }> {
		const routeFarePrice = await this.routeFarePriceRepo.findOne({
			where: { route_fare_price_id: routeFarePriceId },
		});

		if (!routeFarePrice) {
			throw new NotFoundException(`Route fare price ${routeFarePriceId} not found`);
		}

		await this.routeFarePriceRepo.remove(routeFarePrice);

		return {
			success: true,
			message: `Route fare price ${routeFarePriceId} deleted successfully`,
		};
	}

	// ==================== BAGGAGE ALLOWANCE MANAGEMENT (ANCILLARY_MANAGER) ====================

	/**
	 * Create a new baggage allowance
	 */
	async createBaggageAllowance(dto: CreateBaggageAllowanceDto): Promise<BaggageAllowance> {
		// Validate fare class exists
		const fareClass = await this.fareClassRepo.findOne({
			where: { fare_class_code: dto.fareClassCode },
		});

		if (!fareClass) {
			throw new NotFoundException(`Fare class ${dto.fareClassCode} not found`);
		}

		// Create baggage allowance
		const baggageAllowance = this.baggageAllowanceRepo.create({
			baggage_allowance_id: randomUUID(),
			fare_class_code: dto.fareClassCode,
			checked_baggage_kg: dto.checkedBaggageKg ?? null,
			checked_baggage_pieces: dto.checkedBaggagePieces ?? null,
			carry_on_kg: dto.carryOnKg ?? 7,
			carry_on_pieces: dto.carryOnPieces ?? 1,
			carry_on_dimensions: dto.carryOnDimensions || null,
			is_domestic: dto.isDomestic ?? true,
			is_international: dto.isInternational ?? true,
			notes: dto.notes || null,
		});

		return await this.baggageAllowanceRepo.save(baggageAllowance);
	}

	/**
	 * Get all baggage allowances with pagination
	 */
	async getAllBaggageAllowances(dto: GetBaggageAllowancesDto = { page: 1, limit: 20 }): Promise<BaggageAllowancesResponseDto> {
		const page = dto.page || 1;
		const limit = dto.limit || 20;
		const skip = (page - 1) * limit;

		// Validate limit is one of allowed values
		const allowedLimits = [20, 50, 100, 200];
		const validLimit = allowedLimits.includes(limit) ? limit : 20;

		// Get total count and paginated results
		const [baggageAllowances, totalItems] = await this.baggageAllowanceRepo.findAndCount({
			relations: ['fare_class'],
			order: { fare_class_code: 'ASC' },
			skip,
			take: validLimit,
		});

		const totalPages = Math.ceil(totalItems / validLimit);

		return {
			data: baggageAllowances,
			currentPage: page,
			pageSize: validLimit,
			totalItems,
			totalPages,
			hasNextPage: page < totalPages,
			hasPreviousPage: page > 1,
		};
	}

	/**
	 * Get baggage allowance by ID
	 */
	async getBaggageAllowanceById(baggageAllowanceId: string): Promise<BaggageAllowance> {
		const baggageAllowance = await this.baggageAllowanceRepo.findOne({
			where: { baggage_allowance_id: baggageAllowanceId },
			relations: ['fare_class'],
		});

		if (!baggageAllowance) {
			throw new NotFoundException(`Baggage allowance ${baggageAllowanceId} not found`);
		}

		return baggageAllowance;
	}

	/**
	 * Update baggage allowance
	 */
	async updateBaggageAllowance(
		baggageAllowanceId: string,
		dto: UpdateBaggageAllowanceDto,
	): Promise<BaggageAllowance> {
		const baggageAllowance = await this.baggageAllowanceRepo.findOne({
			where: { baggage_allowance_id: baggageAllowanceId },
		});

		if (!baggageAllowance) {
			throw new NotFoundException(`Baggage allowance ${baggageAllowanceId} not found`);
		}

		// Update fields
		if (dto.checkedBaggageKg !== undefined) baggageAllowance.checked_baggage_kg = dto.checkedBaggageKg;
		if (dto.checkedBaggagePieces !== undefined) baggageAllowance.checked_baggage_pieces = dto.checkedBaggagePieces;
		if (dto.carryOnKg !== undefined) baggageAllowance.carry_on_kg = dto.carryOnKg;
		if (dto.carryOnPieces !== undefined) baggageAllowance.carry_on_pieces = dto.carryOnPieces;
		if (dto.carryOnDimensions !== undefined) baggageAllowance.carry_on_dimensions = dto.carryOnDimensions;
		if (dto.isDomestic !== undefined) baggageAllowance.is_domestic = dto.isDomestic;
		if (dto.isInternational !== undefined) baggageAllowance.is_international = dto.isInternational;
		if (dto.notes !== undefined) baggageAllowance.notes = dto.notes;

		baggageAllowance.updated_at = new Date();

		return await this.baggageAllowanceRepo.save(baggageAllowance);
	}

	/**
	 * Delete baggage allowance
	 */
	async deleteBaggageAllowance(baggageAllowanceId: string): Promise<{ success: boolean; message: string }> {
		const baggageAllowance = await this.baggageAllowanceRepo.findOne({
			where: { baggage_allowance_id: baggageAllowanceId },
		});

		if (!baggageAllowance) {
			throw new NotFoundException(`Baggage allowance ${baggageAllowanceId} not found`);
		}

		await this.baggageAllowanceRepo.remove(baggageAllowance);

		return {
			success: true,
			message: `Baggage allowance ${baggageAllowanceId} deleted successfully`,
		};
	}

	// ==================== CABIN SERVICE MANAGEMENT (ANCILLARY_MANAGER) ====================

	/**
	 * Create a new cabin service
	 */
	async createCabinService(dto: CreateCabinServiceDto): Promise<CabinService> {
		// Validate cabin class if provided
		if (dto.cabinClassCode) {
			const cabinClass = await this.cabinClassRepo.findOne({
				where: { cabin_class_code: dto.cabinClassCode },
			});

			if (!cabinClass) {
				throw new NotFoundException(`Cabin class ${dto.cabinClassCode} not found`);
			}
		}

		// Validate fare class if provided
		if (dto.fareClassCode) {
			const fareClass = await this.fareClassRepo.findOne({
				where: { fare_class_code: dto.fareClassCode },
			});

			if (!fareClass) {
				throw new NotFoundException(`Fare class ${dto.fareClassCode} not found`);
			}
		}

		// At least one of cabin_class_code or fare_class_code must be provided
		if (!dto.cabinClassCode && !dto.fareClassCode) {
			throw new BadRequestException('Either cabinClassCode or fareClassCode must be provided');
		}

		// Create cabin service
		const cabinService = this.cabinServiceRepo.create({
			cabin_service_id: randomUUID(),
			cabin_class_code: dto.cabinClassCode || null,
			fare_class_code: dto.fareClassCode || null,
			service_type: dto.serviceType,
			service_name: dto.serviceName,
			description: dto.description || null,
			is_included: dto.isIncluded ?? true,
			price: dto.price ?? null,
			is_active: dto.isActive ?? true,
			display_order: dto.displayOrder ?? 0,
			icon_url: dto.iconUrl || null,
		});

		return await this.cabinServiceRepo.save(cabinService);
	}

	/**
	 * Get all cabin services
	 */
	async getAllCabinServices(): Promise<CabinService[]> {
		return await this.cabinServiceRepo.find({
			relations: ['cabin_class', 'fare_class'],
			order: { display_order: 'ASC', service_type: 'ASC' },
		});
	}

	/**
	 * Get cabin service by ID
	 */
	async getCabinServiceById(cabinServiceId: string): Promise<CabinService> {
		const cabinService = await this.cabinServiceRepo.findOne({
			where: { cabin_service_id: cabinServiceId },
			relations: ['cabin_class', 'fare_class'],
		});

		if (!cabinService) {
			throw new NotFoundException(`Cabin service ${cabinServiceId} not found`);
		}

		return cabinService;
	}

	/**
	 * Update cabin service
	 */
	async updateCabinService(cabinServiceId: string, dto: UpdateCabinServiceDto): Promise<CabinService> {
		const cabinService = await this.cabinServiceRepo.findOne({
			where: { cabin_service_id: cabinServiceId },
		});

		if (!cabinService) {
			throw new NotFoundException(`Cabin service ${cabinServiceId} not found`);
		}

		// Update fields
		if (dto.serviceName !== undefined) cabinService.service_name = dto.serviceName;
		if (dto.description !== undefined) cabinService.description = dto.description;
		if (dto.isIncluded !== undefined) cabinService.is_included = dto.isIncluded;
		if (dto.price !== undefined) cabinService.price = dto.price;
		if (dto.isActive !== undefined) cabinService.is_active = dto.isActive;
		if (dto.displayOrder !== undefined) cabinService.display_order = dto.displayOrder;
		if (dto.iconUrl !== undefined) cabinService.icon_url = dto.iconUrl;

		cabinService.updated_at = new Date();

		return await this.cabinServiceRepo.save(cabinService);
	}

	/**
	 * Delete cabin service
	 */
	async deleteCabinService(cabinServiceId: string): Promise<{ success: boolean; message: string }> {
		const cabinService = await this.cabinServiceRepo.findOne({
			where: { cabin_service_id: cabinServiceId },
		});

		if (!cabinService) {
			throw new NotFoundException(`Cabin service ${cabinServiceId} not found`);
		}

		await this.cabinServiceRepo.remove(cabinService);

		return {
			success: true,
			message: `Cabin service ${cabinServiceId} deleted successfully`,
		};
	}

	// ==================== FARE DESCRIPTION RULE MANAGEMENT ====================

	/**
	 * Create a new fare description rule
	 */
	async createFareDescriptionRule(dto: CreateFareDescriptionRuleDto): Promise<FareDescriptionRule> {
		const rule = this.fareDescriptionRuleRepo.create({
			fare_class_code_pattern: dto.fareClassCodePattern,
			cabin_type: dto.cabinType,
			description_text: dto.descriptionText,
			status: dto.status ?? true,
			display_order: dto.displayOrder ?? 0,
			is_active: dto.isActive ?? true,
			is_default: dto.isDefault ?? false,
		});

		return await this.fareDescriptionRuleRepo.save(rule);
	}

	/**
	 * Get all fare description rules
	 */
	async getAllFareDescriptionRules(): Promise<FareDescriptionRule[]> {
		return await this.fareDescriptionRuleRepo.find({
			order: {
				cabin_type: 'ASC',
				display_order: 'ASC',
				fare_class_code_pattern: 'ASC',
			},
		});
	}

	/**
	 * Get fare description rule by ID
	 */
	async getFareDescriptionRuleById(ruleId: string): Promise<FareDescriptionRule> {
		const rule = await this.fareDescriptionRuleRepo.findOne({
			where: { id: ruleId },
		});

		if (!rule) {
			throw new NotFoundException(`Fare description rule ${ruleId} not found`);
		}

		return rule;
	}

	/**
	 * Update fare description rule
	 */
	async updateFareDescriptionRule(ruleId: string, dto: UpdateFareDescriptionRuleDto): Promise<FareDescriptionRule> {
		const rule = await this.fareDescriptionRuleRepo.findOne({
			where: { id: ruleId },
		});

		if (!rule) {
			throw new NotFoundException(`Fare description rule ${ruleId} not found`);
		}

		// Update fields
		if (dto.fareClassCodePattern !== undefined) rule.fare_class_code_pattern = dto.fareClassCodePattern;
		if (dto.cabinType !== undefined) rule.cabin_type = dto.cabinType;
		if (dto.descriptionText !== undefined) rule.description_text = dto.descriptionText;
		if (dto.status !== undefined) rule.status = dto.status;
		if (dto.displayOrder !== undefined) rule.display_order = dto.displayOrder;
		if (dto.isActive !== undefined) rule.is_active = dto.isActive;
		if (dto.isDefault !== undefined) rule.is_default = dto.isDefault;

		rule.updated_at = new Date();

		return await this.fareDescriptionRuleRepo.save(rule);
	}

	/**
	 * Delete fare description rule
	 */
	async deleteFareDescriptionRule(ruleId: string): Promise<{ success: boolean; message: string }> {
		const rule = await this.fareDescriptionRuleRepo.findOne({
			where: { id: ruleId },
		});

		if (!rule) {
			throw new NotFoundException(`Fare description rule ${ruleId} not found`);
		}

		await this.fareDescriptionRuleRepo.remove(rule);

		return {
			success: true,
			message: `Fare description rule ${ruleId} deleted successfully`,
		};
	}
}

