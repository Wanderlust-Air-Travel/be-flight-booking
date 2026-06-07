import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { SystemRole } from 'src/shared/constants/roles';
import { AircraftType } from 'src/shared/entities/aircraft/aircraft-type.entity';
import { Aircraft } from 'src/shared/entities/aircraft/aircraft.entity';
import { CabinClass } from 'src/shared/entities/cabin/cabin-class.entity';
import { CabinService } from 'src/shared/entities/cabin/cabin-service.entity';
import { BaggageAllowance } from 'src/shared/entities/fare/baggage-allowance.entity';
import { FareClass } from 'src/shared/entities/fare/fare-class.entity';
import { FareDescriptionRule } from 'src/shared/entities/fare/fare-description-rule.entity';
import { RouteFarePrice } from 'src/shared/entities/fare/route-fare-price.entity';
import { FlightInstance } from 'src/shared/entities/flight/flight-instance.entity';
import { FlightSchedule } from 'src/shared/entities/flight/flight-schedule.entity';
import { FlightSeat } from 'src/shared/entities/flight/flight-seat.entity';
import { Role } from 'src/shared/entities/role/role.entity';
import { Route } from 'src/shared/entities/route/route.entity';
import { SeatConfiguration } from 'src/shared/entities/seat/seat-configuration.entity';
import { UserRole } from 'src/shared/entities/user/user-role.entity';
import { User } from 'src/shared/entities/user/user.entity';
import type { DataSource, Repository } from 'typeorm';
import type { AssignRoleDto } from './dto/assign-role.dto';
import type { BaggageAllowancesResponseDto } from './dto/baggage-allowances-response.dto';
import type { CabinServiceResponseDto } from './dto/cabin-service-response.dto';
import type { CreateBaggageAllowanceDto } from './dto/create-baggage-allowance.dto';
import type { CreateCabinServiceDto } from './dto/create-cabin-service.dto';
import type { CreateFareClassDto } from './dto/create-fare-class.dto';
import type { CreateFareDescriptionRuleDto } from './dto/create-fare-description-rule.dto';
import type { CreateFlightInstanceDto } from './dto/create-flight-instance.dto';
import type { CreateFlightScheduleDto } from './dto/create-flight-schedule.dto';
import type { CreateRouteFarePriceDto } from './dto/create-route-fare-price.dto';
import type { DashboardItemDto, DashboardResponseDto } from './dto/dashboard-item.dto';
import type { FlightScheduleResponseDto } from './dto/flight-schedule-response.dto';
import type { FlightSchedulesResponseDto } from './dto/flight-schedules-response.dto';
import type { GetBaggageAllowancesDto } from './dto/get-baggage-allowances.dto';
import type { GetFlightSchedulesDto } from './dto/get-flight-schedules.dto';
import type { GetRouteFarePricesDto } from './dto/get-route-fare-prices.dto';
import type { GetUsersDto } from './dto/get-users.dto';
import type { RemoveRoleDto } from './dto/remove-role.dto';
import type { RouteFarePricesResponseDto } from './dto/route-fare-prices-response.dto';
import type { UpdateBaggageAllowanceDto } from './dto/update-baggage-allowance.dto';
import type { UpdateCabinServiceDto } from './dto/update-cabin-service.dto';
import type { UpdateFareClassDto } from './dto/update-fare-class.dto';
import type { UpdateFareDescriptionRuleDto } from './dto/update-fare-description-rule.dto';
import type { UpdateFlightInstanceDto } from './dto/update-flight-instance.dto';
import type { UpdateFlightScheduleDto } from './dto/update-flight-schedule.dto';
import type { UpdateRouteFarePriceDto } from './dto/update-route-fare-price.dto';
import type { UsersResponseDto } from './dto/users-response.dto';

@Injectable()
export class AdminService {
    private readonly logger = new Logger(AdminService.name);

    constructor(
        @InjectRepository(FareClass) private readonly _fareClassRepo: Repository<FareClass>,
        @InjectRepository(CabinClass) private readonly _cabinClassRepo: Repository<CabinClass>,
        @InjectRepository(FlightSchedule)
        private readonly _flightScheduleRepo: Repository<FlightSchedule>,
        @InjectRepository(FlightInstance)
        private readonly _flightInstanceRepo: Repository<FlightInstance>,
        @InjectRepository(Route) private readonly _routeRepo: Repository<Route>,
        @InjectRepository(AircraftType)
        private readonly _aircraftTypeRepo: Repository<AircraftType>,
        @InjectRepository(Aircraft) private readonly _aircraftRepo: Repository<Aircraft>,
        @InjectRepository(FlightSeat) private readonly _flightSeatRepo: Repository<FlightSeat>,
        @InjectRepository(SeatConfiguration)
        private readonly _seatConfigRepo: Repository<SeatConfiguration>,
        @InjectRepository(User) private readonly _userRepo: Repository<User>,
        @InjectRepository(UserRole) private readonly _userRoleRepo: Repository<UserRole>,
        @InjectRepository(Role) private readonly _roleRepo: Repository<Role>,
        @InjectRepository(RouteFarePrice)
        private readonly _routeFarePriceRepo: Repository<RouteFarePrice>,
        @InjectRepository(BaggageAllowance)
        private readonly _baggageAllowanceRepo: Repository<BaggageAllowance>,
        @InjectRepository(CabinService)
        private readonly _cabinServiceRepo: Repository<CabinService>,
        @InjectRepository(FareDescriptionRule)
        private readonly _fareDescriptionRuleRepo: Repository<FareDescriptionRule>,
        @InjectDataSource() private readonly dataSource: DataSource
    ) {}

    // ==================== FARE MANAGEMENT ====================

    private get fareClassRepo(): Repository<FareClass> {
        return this._fareClassRepo;
    }

    private get cabinClassRepo(): Repository<CabinClass> {
        return this._cabinClassRepo;
    }

    private get flightScheduleRepo(): Repository<FlightSchedule> {
        return this._flightScheduleRepo;
    }

    private get flightInstanceRepo(): Repository<FlightInstance> {
        return this._flightInstanceRepo;
    }

    private get routeRepo(): Repository<Route> {
        return this._routeRepo;
    }

    private get aircraftTypeRepo(): Repository<AircraftType> {
        return this._aircraftTypeRepo;
    }

    private get aircraftRepo(): Repository<Aircraft> {
        return this._aircraftRepo;
    }

    private get flightSeatRepo(): Repository<FlightSeat> {
        return this._flightSeatRepo;
    }

    private get seatConfigRepo(): Repository<SeatConfiguration> {
        return this._seatConfigRepo;
    }

    private get userRepo(): Repository<User> {
        return this._userRepo;
    }

    private get userRoleRepo(): Repository<UserRole> {
        return this._userRoleRepo;
    }

    private get roleRepo(): Repository<Role> {
        return this._roleRepo;
    }

    private get routeFarePriceRepo(): Repository<RouteFarePrice> {
        return this._routeFarePriceRepo;
    }

    private get baggageAllowanceRepo(): Repository<BaggageAllowance> {
        return this._baggageAllowanceRepo;
    }

    private get cabinServiceRepo(): Repository<CabinService> {
        return this._cabinServiceRepo;
    }

    private get fareDescriptionRuleRepo(): Repository<FareDescriptionRule> {
        return this._fareDescriptionRuleRepo;
    }

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
        return (
            (await this.fareClassRepo.findOne({
                where: { fare_class_code: savedFareClass.fare_class_code },
                relations: ['cabin_class'],
            })) || savedFareClass
        );
    }

    /**
     * Get all fare classes
     */
    async getAllFareClasses(): Promise<FareClass[]> {
        // Note: FareClass doesn't have created_at in schema, so we sort by fare_class_code
        // If you need created_at sorting, you'll need to add created_at column to FareClasses table
        return await this.fareClassRepo.find({
            relations: ['cabin_class'],
            order: { fare_class_code: 'DESC' },
        });
    }

    /**
     * Get all cabin classes
     */
    async getAllCabinClasses(): Promise<CabinClass[]> {
        return await this.cabinClassRepo.find({
            order: { cabin_class_code: 'ASC' },
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
                { effectiveFrom, effectiveTo }
            )
            .getOne();

        if (overlapping) {
            throw new BadRequestException(
                `Flight schedule ${dto.flightNumber} already exists for the specified date range`
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
            relations: [
                'route',
                'route.origin_airport',
                'route.destination_airport',
                'aircraft_type',
            ],
        });

        return this.transformFlightScheduleToDto(scheduleWithRelations!);
    }

    /**
     * Get all flight schedules with pagination
     */
    async getAllFlightSchedules(
        dto: GetFlightSchedulesDto = { page: 1, limit: 20 }
    ): Promise<FlightSchedulesResponseDto> {
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

        // Use query builder for search with joins
        const queryBuilder = this.flightScheduleRepo
            .createQueryBuilder('schedule')
            .leftJoinAndSelect('schedule.route', 'route')
            .leftJoinAndSelect('route.origin_airport', 'origin_airport')
            .leftJoinAndSelect('route.destination_airport', 'destination_airport')
            .leftJoinAndSelect('schedule.aircraft_type', 'aircraft_type')
            .orderBy('schedule.effective_from', 'DESC')
            .addOrderBy('schedule.flight_number', 'ASC');

        // Add search condition if provided
        if (dto.search?.trim()) {
            const searchTerm = `%${dto.search.trim()}%`;
            queryBuilder.where(
                '(schedule.flight_number LIKE :search OR ' +
                    'origin_airport.iata_code LIKE :search OR ' +
                    'destination_airport.iata_code LIKE :search OR ' +
                    'origin_airport.name LIKE :search OR ' +
                    'destination_airport.name LIKE :search OR ' +
                    'aircraft_type.model LIKE :search OR ' +
                    'aircraft_type.manufacturer LIKE :search)',
                { search: searchTerm }
            );
        }

        // Get total count
        const totalItems = await queryBuilder.getCount();

        // Get paginated results
        const schedules = await queryBuilder.skip(skip).take(validLimit).getMany();

        const totalPages = Math.ceil(totalItems / validLimit);

        return {
            data: schedules.map((schedule) => this.transformFlightScheduleToDto(schedule)),
            currentPage: page,
            pageSize: validLimit,
            totalItems,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
        };
    }

    /**
     * Get flight schedule by ID
     */
    async getFlightScheduleById(flightScheduleId: string): Promise<FlightScheduleResponseDto> {
        const schedule = await this.flightScheduleRepo.findOne({
            where: { flight_schedule_id: flightScheduleId },
            relations: [
                'route',
                'route.origin_airport',
                'route.destination_airport',
                'aircraft_type',
            ],
        });

        if (!schedule) {
            throw new NotFoundException(`Flight schedule ${flightScheduleId} not found`);
        }

        return this.transformFlightScheduleToDto(schedule);
    }

    /**
     * Update flight schedule
     */
    async updateFlightSchedule(
        flightScheduleId: string,
        dto: UpdateFlightScheduleDto
    ): Promise<FlightScheduleResponseDto> {
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
            relations: [
                'route',
                'route.origin_airport',
                'route.destination_airport',
                'aircraft_type',
            ],
        });

        return this.transformFlightScheduleToDto(updatedSchedule!);
    }

    /**
     * Delete flight schedule
     */
    async deleteFlightSchedule(
        flightScheduleId: string
    ): Promise<{ success: boolean; message: string }> {
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
                `Cannot delete flight schedule with ${instances} existing flight instance(s). Please delete or update instances first.`
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
                    `Flight date ${dto.flightDate} is outside schedule's effective period (${schedule.effective_from.toISOString().split('T')[0]} to ${schedule.effective_to.toISOString().split('T')[0]})`
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
                    `Flight instance already exists for ${schedule.flight_number} on ${dto.flightDate}`
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
                if (
                    aircraft.aircraft_type.aircraft_type_id !==
                    schedule.aircraft_type.aircraft_type_id
                ) {
                    throw new BadRequestException(
                        `Aircraft type ${aircraft.aircraft_type.aircraft_type_id} does not match schedule's aircraft type ${schedule.aircraft_type.aircraft_type_id}`
                    );
                }
            } else {
                // Auto-assign available aircraft of matching type
                const availableAircraft = await queryRunner.manager.find(Aircraft, {
                    where: {
                        aircraft_type: {
                            aircraft_type_id: schedule.aircraft_type.aircraft_type_id,
                        },
                        in_service: true,
                    },
                    relations: ['aircraft_type'],
                });

                if (availableAircraft.length === 0) {
                    throw new BadRequestException(
                        `No available aircraft of type ${schedule.aircraft_type.code} found`
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
                })
            );

            // Insert in batches to avoid SQL Server parameter limit
            const batchSize = 1000;
            for (let i = 0; i < flightSeats.length; i += batchSize) {
                const batch = flightSeats.slice(i, i + batchSize);
                await queryRunner.manager.save(FlightSeat, batch);
            }

            await queryRunner.commitTransaction();

            // Reload with relations
            return (await this.flightInstanceRepo.findOne({
                where: { flight_instance_id: savedInstance.flight_instance_id },
                relations: ['flight_schedule', 'aircraft', 'aircraft.aircraft_type'],
            })) as FlightInstance;
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
            relations: [
                'flight_schedule',
                'flight_schedule.route',
                'aircraft',
                'aircraft.aircraft_type',
            ],
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
    async updateFlightInstance(
        flightInstanceId: string,
        dto: UpdateFlightInstanceDto
    ): Promise<FlightInstance> {
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
            if (
                aircraft.aircraft_type.aircraft_type_id !==
                instance.flight_schedule.aircraft_type.aircraft_type_id
            ) {
                throw new BadRequestException(
                    `Aircraft type does not match schedule's aircraft type`
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
    async deleteFlightInstance(
        flightInstanceId: string
    ): Promise<{ success: boolean; message: string }> {
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
            throw new BadRequestException(
                'Cannot remove CUSTOMER role. All users must have CUSTOMER role.'
            );
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

        return user.userRoles.map((ur) => ur.role).filter((role): role is Role => !!role);
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
     * Get all users with their roles (without pagination - for backward compatibility)
     */
    async getAllUsers(): Promise<User[]> {
        return await this.userRepo.find({
            relations: ['userRoles', 'userRoles.role'],
            order: { created_at: 'DESC' },
        });
    }

    /**
     * Get all users with pagination
     */
    async getAllUsersPaginated(
        dto: GetUsersDto = { page: 1, limit: 20 }
    ): Promise<UsersResponseDto> {
        const page = dto.page ? Number(dto.page) : 1;
        const limit = dto.limit ? Number(dto.limit) : 20;

        // Validate limit is one of allowed values
        const allowedLimits = [20, 50, 100, 200];
        const validLimit = allowedLimits.includes(limit) ? limit : 20;

        const skip = (page - 1) * validLimit;

        const [users, totalItems] = await this.userRepo.findAndCount({
            relations: ['userRoles', 'userRoles.role'],
            order: { created_at: 'DESC' },
            skip,
            take: validLimit,
        });

        const totalPages = Math.ceil(totalItems / validLimit);

        return {
            data: users,
            currentPage: page,
            pageSize: validLimit,
            totalItems,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
        };
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
    async getAllRouteFarePrices(
        dto: GetRouteFarePricesDto = { page: 1, limit: 20 }
    ): Promise<RouteFarePricesResponseDto> {
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

        // Use query builder for search with joins
        const queryBuilder = this.routeFarePriceRepo
            .createQueryBuilder('route_fare_price')
            .leftJoinAndSelect('route_fare_price.route', 'route')
            .leftJoinAndSelect('route.origin_airport', 'origin_airport')
            .leftJoinAndSelect('route.destination_airport', 'destination_airport')
            .leftJoinAndSelect('route_fare_price.fare_class', 'fare_class')
            .orderBy('route_fare_price.created_at', 'DESC');

        // Build where conditions array
        const whereConditions: string[] = [];
        const whereParams: any = {};

        // Filter by active status first (if provided)
        if (dto.filterActive && dto.filterActive !== 'all') {
            if (dto.filterActive === 'active') {
                whereConditions.push('CAST(route_fare_price.is_active AS INT) = 1');
            } else if (dto.filterActive === 'inactive') {
                whereConditions.push('CAST(route_fare_price.is_active AS INT) = 0');
            }
        }

        // Add search condition if provided
        if (dto.search?.trim()) {
            const searchTerm = `%${dto.search.trim()}%`;
            const searchCondition =
                '(origin_airport.iata_code LIKE :search OR ' +
                'origin_airport.name LIKE :search OR ' +
                'origin_airport.city LIKE :search OR ' +
                'destination_airport.iata_code LIKE :search OR ' +
                'destination_airport.name LIKE :search OR ' +
                'destination_airport.city LIKE :search OR ' +
                'fare_class.fare_class_code LIKE :search OR ' +
                'fare_class.description LIKE :search)';

            if (whereConditions.length > 0) {
                whereConditions.push(searchCondition);
            } else {
                whereConditions.push(searchCondition);
            }
            whereParams.search = searchTerm;
        }

        // Apply where conditions
        if (whereConditions.length > 0) {
            queryBuilder.where(whereConditions.join(' AND '), whereParams);
        }

        // Get total count
        const totalItems = await queryBuilder.getCount();

        // Get paginated results
        const routeFarePrices = await queryBuilder.skip(skip).take(validLimit).getMany();

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
            relations: ['route', 'route.origin_airport', 'route.destination_airport', 'fare_class'],
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
        dto: UpdateRouteFarePriceDto
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
        if (dto.effectiveFrom !== undefined)
            routeFarePrice.effective_from = new Date(dto.effectiveFrom);
        if (dto.effectiveTo !== undefined)
            routeFarePrice.effective_to = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
        if (dto.isActive !== undefined) routeFarePrice.is_active = dto.isActive;
        if (dto.priority !== undefined) routeFarePrice.priority = dto.priority;
        if (dto.notes !== undefined) routeFarePrice.notes = dto.notes;

        routeFarePrice.updated_at = new Date();

        return await this.routeFarePriceRepo.save(routeFarePrice);
    }

    /**
     * Delete route fare price
     */
    async deleteRouteFarePrice(
        routeFarePriceId: string
    ): Promise<{ success: boolean; message: string }> {
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
     * Get all baggage allowances with pagination and search
     */
    async getAllBaggageAllowances(
        dto: GetBaggageAllowancesDto = { page: 1, limit: 20 }
    ): Promise<BaggageAllowancesResponseDto> {
        const page = dto.page || 1;
        const limit = dto.limit || 20;
        const skip = (page - 1) * limit;

        // Validate limit is one of allowed values
        const allowedLimits = [20, 50, 100, 200];
        const validLimit = allowedLimits.includes(limit) ? limit : 20;

        // Use query builder for search with join
        const queryBuilder = this.baggageAllowanceRepo
            .createQueryBuilder('baggage_allowance')
            .leftJoinAndSelect('baggage_allowance.fare_class', 'fare_class')
            .orderBy('baggage_allowance.created_at', 'DESC');

        // Add search condition if provided
        if (dto.search?.trim()) {
            const searchTerm = `%${dto.search.trim()}%`;
            queryBuilder.where(
                '(fare_class.fare_class_code LIKE :search OR fare_class.description LIKE :search)',
                { search: searchTerm }
            );
        }

        // Get total count
        const totalItems = await queryBuilder.getCount();

        // Get paginated results
        const baggageAllowances = await queryBuilder.skip(skip).take(validLimit).getMany();

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
        dto: UpdateBaggageAllowanceDto
    ): Promise<BaggageAllowance> {
        const baggageAllowance = await this.baggageAllowanceRepo.findOne({
            where: { baggage_allowance_id: baggageAllowanceId },
        });

        if (!baggageAllowance) {
            throw new NotFoundException(`Baggage allowance ${baggageAllowanceId} not found`);
        }

        // Update fields
        if (dto.checkedBaggageKg !== undefined)
            baggageAllowance.checked_baggage_kg = dto.checkedBaggageKg;
        if (dto.checkedBaggagePieces !== undefined)
            baggageAllowance.checked_baggage_pieces = dto.checkedBaggagePieces;
        if (dto.carryOnKg !== undefined) baggageAllowance.carry_on_kg = dto.carryOnKg;
        if (dto.carryOnPieces !== undefined) baggageAllowance.carry_on_pieces = dto.carryOnPieces;
        if (dto.carryOnDimensions !== undefined)
            baggageAllowance.carry_on_dimensions = dto.carryOnDimensions;
        if (dto.isDomestic !== undefined) baggageAllowance.is_domestic = dto.isDomestic;
        if (dto.isInternational !== undefined)
            baggageAllowance.is_international = dto.isInternational;
        if (dto.notes !== undefined) baggageAllowance.notes = dto.notes;

        baggageAllowance.updated_at = new Date();

        return await this.baggageAllowanceRepo.save(baggageAllowance);
    }

    /**
     * Delete baggage allowance
     */
    async deleteBaggageAllowance(
        baggageAllowanceId: string
    ): Promise<{ success: boolean; message: string }> {
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
    async createCabinService(dto: CreateCabinServiceDto): Promise<CabinServiceResponseDto> {
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
            throw new BadRequestException(
                'Either cabinClassCode or fareClassCode must be provided'
            );
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

        const savedService = await this.cabinServiceRepo.save(cabinService);

        // Reload with relations to transform to DTO
        const serviceWithRelations = await this.cabinServiceRepo
            .createQueryBuilder('cabin_service')
            .leftJoinAndSelect('cabin_service.cabin_class', 'cabin_class')
            .leftJoinAndSelect('cabin_service.fare_class', 'fare_class')
            .leftJoinAndSelect('fare_class.cabin_class', 'fare_class_cabin_class')
            .where('cabin_service.cabin_service_id = :id', { id: savedService.cabin_service_id })
            .getOne();

        if (!serviceWithRelations) {
            throw new NotFoundException(
                `Cabin service ${savedService.cabin_service_id} not found after creation`
            );
        }

        return this.transformCabinServiceToDto(serviceWithRelations);
    }

    /**
     * Get all cabin services
     */
    async getAllCabinServices(dto?: {
        search?: string;
        filterActive?: 'all' | 'active' | 'inactive';
    }): Promise<CabinServiceResponseDto[]> {
        // Build query with filters at database level for better performance
        const queryBuilder = this.cabinServiceRepo
            .createQueryBuilder('cabin_service')
            .leftJoinAndSelect('cabin_service.cabin_class', 'cabin_class')
            .leftJoinAndSelect('cabin_service.fare_class', 'fare_class')
            .leftJoinAndSelect('fare_class.cabin_class', 'fare_class_cabin_class')
            .orderBy('cabin_service.created_at', 'DESC');

        // Filter by active status at database level
        if (dto?.filterActive && dto.filterActive !== 'all') {
            if (dto.filterActive === 'active') {
                queryBuilder.where('cabin_service.is_active = :isActive', { isActive: true });
            } else if (dto.filterActive === 'inactive') {
                queryBuilder.where('cabin_service.is_active = :isActive', { isActive: false });
            }
        }

        // Filter by search query
        if (dto?.search?.trim()) {
            const searchTerm = `%${dto.search.trim()}%`;
            if (dto?.filterActive && dto.filterActive !== 'all') {
                // Add AND condition if filterActive is already set
                queryBuilder.andWhere(
                    '(cabin_service.service_type LIKE :search OR ' +
                        'cabin_service.service_name LIKE :search OR ' +
                        'cabin_service.description LIKE :search OR ' +
                        'cabin_class.name LIKE :search OR ' +
                        'fare_class.fare_class_code LIKE :search OR ' +
                        'fare_class.description LIKE :search)',
                    { search: searchTerm }
                );
            } else {
                // Use WHERE if filterActive is not set
                queryBuilder.where(
                    '(cabin_service.service_type LIKE :search OR ' +
                        'cabin_service.service_name LIKE :search OR ' +
                        'cabin_service.description LIKE :search OR ' +
                        'cabin_class.name LIKE :search OR ' +
                        'fare_class.fare_class_code LIKE :search OR ' +
                        'fare_class.description LIKE :search)',
                    { search: searchTerm }
                );
            }
        }

        const entities = await queryBuilder.getMany();

        // Transform entities to DTOs with camelCase properties
        return entities.map((entity) => this.transformCabinServiceToDto(entity));
    }

    /**
     * Transform CabinService entity to CabinServiceResponseDto
     */
    private transformCabinServiceToDto(entity: CabinService): CabinServiceResponseDto {
        return {
            cabinServiceId: entity.cabin_service_id,
            cabinClassCode: entity.cabin_class_code,
            cabinClass: entity.cabin_class
                ? {
                      cabinClassCode: entity.cabin_class.cabin_class_code,
                      name: entity.cabin_class.name,
                  }
                : null,
            fareClassCode: entity.fare_class_code,
            fareClass: entity.fare_class
                ? {
                      fareClassCode: entity.fare_class.fare_class_code,
                      cabinClassCode: entity.fare_class.cabin_class?.cabin_class_code || '',
                      description: entity.fare_class.description || null,
                  }
                : null,
            serviceType: entity.service_type,
            serviceName: entity.service_name,
            description: entity.description,
            isIncluded: entity.is_included,
            price: entity.price ? Number(entity.price) : null,
            isActive: entity.is_active,
            displayOrder: entity.display_order,
            iconUrl: entity.icon_url,
            createdAt: entity.created_at,
            updatedAt: entity.updated_at,
        };
    }

    /**
     * Get cabin service by ID
     */
    async getCabinServiceById(cabinServiceId: string): Promise<CabinServiceResponseDto> {
        const cabinService = await this.cabinServiceRepo
            .createQueryBuilder('cabin_service')
            .leftJoinAndSelect('cabin_service.cabin_class', 'cabin_class')
            .leftJoinAndSelect('cabin_service.fare_class', 'fare_class')
            .leftJoinAndSelect('fare_class.cabin_class', 'fare_class_cabin_class')
            .where('cabin_service.cabin_service_id = :id', { id: cabinServiceId })
            .getOne();

        if (!cabinService) {
            throw new NotFoundException(`Cabin service ${cabinServiceId} not found`);
        }

        return this.transformCabinServiceToDto(cabinService);
    }

    /**
     * Update cabin service
     */
    async updateCabinService(
        cabinServiceId: string,
        dto: UpdateCabinServiceDto
    ): Promise<CabinServiceResponseDto> {
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

        await this.cabinServiceRepo.save(cabinService);

        // Reload with relations to transform to DTO
        const updatedService = await this.cabinServiceRepo
            .createQueryBuilder('cabin_service')
            .leftJoinAndSelect('cabin_service.cabin_class', 'cabin_class')
            .leftJoinAndSelect('cabin_service.fare_class', 'fare_class')
            .leftJoinAndSelect('fare_class.cabin_class', 'fare_class_cabin_class')
            .where('cabin_service.cabin_service_id = :id', { id: cabinServiceId })
            .getOne();

        if (!updatedService) {
            throw new NotFoundException(`Cabin service ${cabinServiceId} not found after update`);
        }

        return this.transformCabinServiceToDto(updatedService);
    }

    /**
     * Delete cabin service
     */
    async deleteCabinService(
        cabinServiceId: string
    ): Promise<{ success: boolean; message: string }> {
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
    async createFareDescriptionRule(
        dto: CreateFareDescriptionRuleDto
    ): Promise<FareDescriptionRule> {
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
    async updateFareDescriptionRule(
        ruleId: string,
        dto: UpdateFareDescriptionRuleDto
    ): Promise<FareDescriptionRule> {
        const rule = await this.fareDescriptionRuleRepo.findOne({
            where: { id: ruleId },
        });

        if (!rule) {
            throw new NotFoundException(`Fare description rule ${ruleId} not found`);
        }

        // Update fields
        if (dto.fareClassCodePattern !== undefined)
            rule.fare_class_code_pattern = dto.fareClassCodePattern;
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
    async deleteFareDescriptionRule(
        ruleId: string
    ): Promise<{ success: boolean; message: string }> {
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

    // ==================== DASHBOARD MANAGEMENT ====================

    /**
     * Get dashboard items based on user roles
     */
    async getDashboardItems(userId: string): Promise<DashboardResponseDto> {
        // Get user roles
        const userRoles = await this.userRoleRepo.find({
            where: { user_id: userId },
            relations: ['role'],
        });

        // Extract role codes
        const userRoleCodes = userRoles
            .map((ur) => ur.role?.role_code)
            .filter((code): code is string => !!code);

        // Check if user has ADMIN role (admin has access to everything)
        const isAdmin = userRoleCodes.includes(SystemRole.ADMIN);

        // Define all dashboard items with their required roles
        const allDashboardItems: DashboardItemDto[] = [
            {
                id: 'route-fare-prices',
                title: 'Quản lý giá vé theo route',
                description: 'Quản lý giá vé và giá cả',
                href: '/admin/route-fare-prices',
                icon: 'TrendingUp',
                color: 'text-green-600',
                bgColor: 'bg-green-50',
                requiredRoles: [
                    SystemRole.ADMIN,
                    SystemRole.REVENUE_ANALYST,
                    SystemRole.DISTRIBUTION_MANAGER,
                ],
            },
            {
                id: 'baggage-allowances',
                title: 'Quản lý quy định hành lý',
                description: 'Quản lý quy định hành lý và giới hạn',
                href: '/admin/baggage-allowances',
                icon: 'Luggage',
                color: 'text-orange-600',
                bgColor: 'bg-orange-50',
                requiredRoles: [
                    SystemRole.ADMIN,
                    SystemRole.ANCILLARY_MANAGER,
                    SystemRole.CALL_CENTER,
                    SystemRole.DISTRIBUTION_MANAGER,
                ],
            },
            {
                id: 'cabin-services',
                title: 'Quản lý dịch vụ cabin',
                description: 'Quản lý dịch vụ cabin và tiện ích',
                href: '/admin/cabin-services',
                icon: 'Sparkles',
                color: 'text-purple-600',
                bgColor: 'bg-purple-50',
                requiredRoles: [
                    SystemRole.ADMIN,
                    SystemRole.ANCILLARY_MANAGER,
                    SystemRole.CALL_CENTER,
                    SystemRole.DISTRIBUTION_MANAGER,
                ],
            },
            {
                id: 'fare-classes',
                title: 'Quản lý hạng vé',
                description: 'Quản lý hạng vé và giá cả',
                href: '/admin/fare-classes',
                icon: 'DollarSign',
                color: 'text-green-600',
                bgColor: 'bg-green-50',
                requiredRoles: [
                    SystemRole.ADMIN,
                    SystemRole.REVENUE_ANALYST,
                    SystemRole.FARE_MANAGER,
                    SystemRole.DISTRIBUTION_MANAGER,
                    SystemRole.ANCILLARY_MANAGER,
                    SystemRole.CALL_CENTER,
                ],
            },
            {
                id: 'flight-schedules',
                title: 'Quản lý lịch chuyến bay',
                description: 'Quản lý lịch chuyến bay và chuyến bay thực tế',
                href: '/admin/flight-schedules',
                icon: 'Plane',
                color: 'text-blue-600',
                bgColor: 'bg-blue-50',
                requiredRoles: [
                    SystemRole.ADMIN,
                    SystemRole.SCHEDULE_PLANNER,
                    SystemRole.FLIGHT_MANAGER,
                    SystemRole.CALL_CENTER,
                    SystemRole.OPERATIONS,
                    SystemRole.DISTRIBUTION_MANAGER,
                ],
            },
            {
                id: 'users',
                title: 'Quản lý người dùng',
                description: 'Quản lý người dùng và phân quyền',
                href: '/admin/users',
                icon: 'Users',
                color: 'text-purple-600',
                bgColor: 'bg-purple-50',
                requiredRoles: [SystemRole.ADMIN],
            },
        ];

        // Filter items based on user roles
        const accessibleItems = allDashboardItems.filter((item) => {
            if (isAdmin) {
                return true; // Admin has access to everything
            }
            // Check if user has any of the required roles
            return item.requiredRoles?.some((role) => userRoleCodes.includes(role)) ?? false;
        });

        // Remove requiredRoles from response (it's internal only)
        const items = accessibleItems.map(({ requiredRoles, ...item }) => item);
        const menuItems = accessibleItems.map(({ requiredRoles, ...item }) => item);

        return {
            items,
            menuItems,
        };
    }
}
