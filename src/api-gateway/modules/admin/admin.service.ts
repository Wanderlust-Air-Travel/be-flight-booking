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
import { CreateFareClassDto } from './dto/create-fare-class.dto';
import { UpdateFareClassDto } from './dto/update-fare-class.dto';
import { CreateFlightScheduleDto } from './dto/create-flight-schedule.dto';
import { UpdateFlightScheduleDto } from './dto/update-flight-schedule.dto';
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

		return await this.fareClassRepo.save(fareClass);
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
	 * Create a new flight schedule
	 */
	async createFlightSchedule(dto: CreateFlightScheduleDto): Promise<FlightSchedule> {
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

		return await this.flightScheduleRepo.save(flightSchedule);
	}

	/**
	 * Get all flight schedules
	 */
	async getAllFlightSchedules(): Promise<FlightSchedule[]> {
		return await this.flightScheduleRepo.find({
			relations: ['route', 'route.origin_airport', 'route.destination_airport', 'aircraft_type'],
			order: { flight_number: 'ASC', effective_from: 'DESC' },
		});
	}

	/**
	 * Get flight schedule by ID
	 */
	async getFlightScheduleById(flightScheduleId: string): Promise<FlightSchedule> {
		const schedule = await this.flightScheduleRepo.findOne({
			where: { flight_schedule_id: flightScheduleId },
			relations: ['route', 'route.origin_airport', 'route.destination_airport', 'aircraft_type'],
		});

		if (!schedule) {
			throw new NotFoundException(`Flight schedule ${flightScheduleId} not found`);
		}

		return schedule;
	}

	/**
	 * Update flight schedule
	 */
	async updateFlightSchedule(flightScheduleId: string, dto: UpdateFlightScheduleDto): Promise<FlightSchedule> {
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

		return await this.flightScheduleRepo.save(schedule);
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
}

