import {
	Controller,
	Get,
	Post,
	Put,
	Delete,
	Body,
	Param,
	Query,
	UseGuards,
	Logger,
	BadRequestException,
	InternalServerErrorException,
} from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiBearerAuth,
	ApiOkResponse,
	ApiBadRequestResponse,
	ApiParam,
	ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/shared/guards/roles.guard';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { SystemRole } from 'src/shared/constants/roles';
import { AdminService } from './admin.service';
import { CreateFareClassDto } from './dto/create-fare-class.dto';
import { UpdateFareClassDto } from './dto/update-fare-class.dto';
import { CreateFlightScheduleDto } from './dto/create-flight-schedule.dto';
import { UpdateFlightScheduleDto } from './dto/update-flight-schedule.dto';
import { FlightScheduleResponseDto } from './dto/flight-schedule-response.dto';
import { CreateFlightInstanceDto } from './dto/create-flight-instance.dto';
import { UpdateFlightInstanceDto } from './dto/update-flight-instance.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { RemoveRoleDto } from './dto/remove-role.dto';
import { CreateRouteFarePriceDto } from './dto/create-route-fare-price.dto';
import { UpdateRouteFarePriceDto } from './dto/update-route-fare-price.dto';
import { GetRouteFarePricesDto } from './dto/get-route-fare-prices.dto';
import { RouteFarePricesResponseDto } from './dto/route-fare-prices-response.dto';
import { GetBaggageAllowancesDto } from './dto/get-baggage-allowances.dto';
import { BaggageAllowancesResponseDto } from './dto/baggage-allowances-response.dto';
import { CreateBaggageAllowanceDto } from './dto/create-baggage-allowance.dto';
import { UpdateBaggageAllowanceDto } from './dto/update-baggage-allowance.dto';
import { CreateCabinServiceDto } from './dto/create-cabin-service.dto';
import { UpdateCabinServiceDto } from './dto/update-cabin-service.dto';
import { CreateFareDescriptionRuleDto } from './dto/create-fare-description-rule.dto';
import { UpdateFareDescriptionRuleDto } from './dto/update-fare-description-rule.dto';
import { FareClass } from 'src/shared/entities/fare/fare-class.entity';
import { RouteFarePrice } from 'src/shared/entities/fare/route-fare-price.entity';
import { BaggageAllowance } from 'src/shared/entities/fare/baggage-allowance.entity';
import { CabinService } from 'src/shared/entities/cabin/cabin-service.entity';
import { FareDescriptionRule } from 'src/shared/entities/fare/fare-description-rule.entity';
import { FlightSchedule } from 'src/shared/entities/flight/flight-schedule.entity';
import { FlightInstance } from 'src/shared/entities/flight/flight-instance.entity';
import { Role } from 'src/shared/entities/role/role.entity';
import { User } from 'src/shared/entities/user/user.entity';
import { Route } from 'src/shared/entities/route/route.entity';
import { COMMON_MESSAGES } from 'src/shared/constants/messages';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class AdminController {
	private readonly logger = new Logger(AdminController.name);

	constructor(private readonly adminService: AdminService) {}

	// ==================== FARE MANAGEMENT ====================

	@Post('fare-classes')
	@Roles(SystemRole.ADMIN, SystemRole.REVENUE_ANALYST, SystemRole.FARE_MANAGER)
	@ApiOperation({
		summary: 'Create a new fare class',
		description: 'Create a new fare class. Requires ADMIN or FARE_MANAGER role.',
	})
	@ApiOkResponse({
		description: 'Fare class created successfully',
		type: FareClass,
	})
	@ApiBadRequestResponse({
		description: 'Invalid request or fare class already exists',
	})
	async createFareClass(@Body() dto: CreateFareClassDto): Promise<FareClass> {
		try {
			return await this.adminService.createFareClass(dto);
		} catch (error: any) {
			this.logger.error('Create fare class error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to create fare class: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Get('fare-classes')
	@Roles(SystemRole.ADMIN, SystemRole.REVENUE_ANALYST, SystemRole.FARE_MANAGER, SystemRole.DISTRIBUTION_MANAGER)
	@ApiOperation({
		summary: 'Get all fare classes',
		description: 'Get all fare classes. Requires ADMIN or FARE_MANAGER role.',
	})
	@ApiOkResponse({
		description: 'Fare classes retrieved successfully',
		type: [FareClass],
	})
	async getAllFareClasses(): Promise<FareClass[]> {
		try {
			return await this.adminService.getAllFareClasses();
		} catch (error: any) {
			this.logger.error('Get all fare classes error:', error);
			throw new InternalServerErrorException(
				`Failed to retrieve fare classes: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Get('fare-classes/:code')
	@Roles(SystemRole.ADMIN, SystemRole.REVENUE_ANALYST, SystemRole.FARE_MANAGER, SystemRole.DISTRIBUTION_MANAGER)
	@ApiOperation({
		summary: 'Get fare class by code',
		description: 'Get fare class details by code. Requires ADMIN or FARE_MANAGER role.',
	})
	@ApiParam({
		name: 'code',
		description: 'Fare class code',
		example: 'YS',
	})
	@ApiOkResponse({
		description: 'Fare class retrieved successfully',
		type: FareClass,
	})
	async getFareClassByCode(@Param('code') fareClassCode: string): Promise<FareClass> {
		try {
			return await this.adminService.getFareClassByCode(fareClassCode);
		} catch (error: any) {
			this.logger.error('Get fare class error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to retrieve fare class: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Put('fare-classes/:code')
	@Roles(SystemRole.ADMIN, SystemRole.REVENUE_ANALYST, SystemRole.FARE_MANAGER)
	@ApiOperation({
		summary: 'Update fare class',
		description: 'Update fare class details. Requires ADMIN or FARE_MANAGER role.',
	})
	@ApiParam({
		name: 'code',
		description: 'Fare class code',
		example: 'YS',
	})
	@ApiOkResponse({
		description: 'Fare class updated successfully',
		type: FareClass,
	})
	async updateFareClass(
		@Param('code') fareClassCode: string,
		@Body() dto: UpdateFareClassDto,
	): Promise<FareClass> {
		try {
			return await this.adminService.updateFareClass(fareClassCode, dto);
		} catch (error: any) {
			this.logger.error('Update fare class error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to update fare class: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Delete('fare-classes/:code')
	@Roles(SystemRole.ADMIN, SystemRole.REVENUE_ANALYST, SystemRole.FARE_MANAGER)
	@ApiOperation({
		summary: 'Delete fare class',
		description: 'Delete a fare class. Requires ADMIN or FARE_MANAGER role.',
	})
	@ApiParam({
		name: 'code',
		description: 'Fare class code',
		example: 'YS',
	})
	@ApiOkResponse({
		description: 'Fare class deleted successfully',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: true },
				message: { type: 'string', example: 'Fare class YS deleted successfully' },
			},
		},
	})
	async deleteFareClass(@Param('code') fareClassCode: string): Promise<{ success: boolean; message: string }> {
		try {
			return await this.adminService.deleteFareClass(fareClassCode);
		} catch (error: any) {
			this.logger.error('Delete fare class error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to delete fare class: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	// ==================== FLIGHT SCHEDULE MANAGEMENT ====================

	@Post('flight-schedules')
	@Roles(SystemRole.ADMIN, SystemRole.SCHEDULE_PLANNER, SystemRole.FLIGHT_MANAGER)
	@ApiOperation({
		summary: 'Create a new flight schedule',
		description: 'Create a new flight schedule. Requires ADMIN or FLIGHT_MANAGER role.',
	})
	@ApiOkResponse({
		description: 'Flight schedule created successfully',
		type: FlightScheduleResponseDto,
	})
	@ApiBadRequestResponse({
		description: 'Invalid request or overlapping schedule exists',
	})
	async createFlightSchedule(@Body() dto: CreateFlightScheduleDto): Promise<FlightScheduleResponseDto> {
		try {
			return await this.adminService.createFlightSchedule(dto);
		} catch (error: any) {
			this.logger.error('Create flight schedule error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to create flight schedule: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Get('flight-schedules')
	@Roles(SystemRole.ADMIN, SystemRole.SCHEDULE_PLANNER, SystemRole.FLIGHT_MANAGER, SystemRole.CALL_CENTER, SystemRole.OPERATIONS, SystemRole.DISTRIBUTION_MANAGER)
	@ApiOperation({
		summary: 'Get all flight schedules',
		description: 'Get all flight schedules. Requires ADMIN, FLIGHT_MANAGER, or OPERATIONS role.',
	})
	@ApiOkResponse({
		description: 'Flight schedules retrieved successfully',
		type: [FlightScheduleResponseDto],
	})
	async getAllFlightSchedules(): Promise<FlightScheduleResponseDto[]> {
		try {
			return await this.adminService.getAllFlightSchedules();
		} catch (error: any) {
			this.logger.error('Get all flight schedules error:', error);
			throw new InternalServerErrorException(
				`Failed to retrieve flight schedules: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Get('flight-schedules/:id')
	@Roles(SystemRole.ADMIN, SystemRole.SCHEDULE_PLANNER, SystemRole.FLIGHT_MANAGER, SystemRole.CALL_CENTER, SystemRole.OPERATIONS, SystemRole.DISTRIBUTION_MANAGER)
	@ApiOperation({
		summary: 'Get flight schedule by ID',
		description: 'Get flight schedule details by ID. Requires ADMIN, FLIGHT_MANAGER, or OPERATIONS role.',
	})
	@ApiParam({
		name: 'id',
		description: 'Flight schedule ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Flight schedule retrieved successfully',
		type: FlightScheduleResponseDto,
	})
	async getFlightScheduleById(@Param('id') flightScheduleId: string): Promise<FlightScheduleResponseDto> {
		try {
			return await this.adminService.getFlightScheduleById(flightScheduleId);
		} catch (error: any) {
			this.logger.error('Get flight schedule error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to retrieve flight schedule: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Put('flight-schedules/:id')
	@Roles(SystemRole.ADMIN, SystemRole.SCHEDULE_PLANNER, SystemRole.FLIGHT_MANAGER)
	@ApiOperation({
		summary: 'Update flight schedule',
		description: 'Update flight schedule details. Requires ADMIN or FLIGHT_MANAGER role.',
	})
	@ApiParam({
		name: 'id',
		description: 'Flight schedule ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Flight schedule updated successfully',
		type: FlightScheduleResponseDto,
	})
	async updateFlightSchedule(
		@Param('id') flightScheduleId: string,
		@Body() dto: UpdateFlightScheduleDto,
	): Promise<FlightScheduleResponseDto> {
		try {
			return await this.adminService.updateFlightSchedule(flightScheduleId, dto);
		} catch (error: any) {
			this.logger.error('Update flight schedule error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to update flight schedule: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Delete('flight-schedules/:id')
	@Roles(SystemRole.ADMIN, SystemRole.SCHEDULE_PLANNER, SystemRole.FLIGHT_MANAGER)
	@ApiOperation({
		summary: 'Delete flight schedule',
		description: 'Delete a flight schedule. Requires ADMIN or FLIGHT_MANAGER role. Cannot delete if schedule has flight instances.',
	})
	@ApiParam({
		name: 'id',
		description: 'Flight schedule ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Flight schedule deleted successfully',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: true },
				message: { type: 'string', example: 'Flight schedule deleted successfully' },
			},
		},
	})
	async deleteFlightSchedule(@Param('id') flightScheduleId: string): Promise<{ success: boolean; message: string }> {
		try {
			return await this.adminService.deleteFlightSchedule(flightScheduleId);
		} catch (error: any) {
			this.logger.error('Delete flight schedule error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to delete flight schedule: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	// ==================== FLIGHT INSTANCE MANAGEMENT ====================

	@Post('flight-instances')
	@Roles(SystemRole.ADMIN, SystemRole.SCHEDULE_PLANNER, SystemRole.FLIGHT_MANAGER)
	@ApiOperation({
		summary: 'Create a new flight instance',
		description: 'Create a new flight instance for a specific date. Requires ADMIN or FLIGHT_MANAGER role.',
	})
	@ApiOkResponse({
		description: 'Flight instance created successfully',
		type: FlightInstance,
	})
	@ApiBadRequestResponse({
		description: 'Invalid request or instance already exists',
	})
	async createFlightInstance(@Body() dto: CreateFlightInstanceDto): Promise<FlightInstance> {
		try {
			return await this.adminService.createFlightInstance(dto);
		} catch (error: any) {
			this.logger.error('Create flight instance error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to create flight instance: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Get('flight-instances')
	@Roles(SystemRole.ADMIN, SystemRole.SCHEDULE_PLANNER, SystemRole.FLIGHT_MANAGER, SystemRole.CALL_CENTER, SystemRole.OPERATIONS, SystemRole.DISTRIBUTION_MANAGER)
	@ApiOperation({
		summary: 'Get all flight instances',
		description: 'Get all flight instances. Requires ADMIN, FLIGHT_MANAGER, or OPERATIONS role.',
	})
	@ApiOkResponse({
		description: 'Flight instances retrieved successfully',
		type: [FlightInstance],
	})
	async getAllFlightInstances(): Promise<FlightInstance[]> {
		try {
			return await this.adminService.getAllFlightInstances();
		} catch (error: any) {
			this.logger.error('Get all flight instances error:', error);
			throw new InternalServerErrorException(
				`Failed to retrieve flight instances: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Get('flight-instances/:id')
	@Roles(SystemRole.ADMIN, SystemRole.SCHEDULE_PLANNER, SystemRole.FLIGHT_MANAGER, SystemRole.CALL_CENTER, SystemRole.OPERATIONS, SystemRole.DISTRIBUTION_MANAGER)
	@ApiOperation({
		summary: 'Get flight instance by ID',
		description: 'Get flight instance details by ID. Requires ADMIN, FLIGHT_MANAGER, or OPERATIONS role.',
	})
	@ApiParam({
		name: 'id',
		description: 'Flight instance ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Flight instance retrieved successfully',
		type: FlightInstance,
	})
	async getFlightInstanceById(@Param('id') flightInstanceId: string): Promise<FlightInstance> {
		try {
			return await this.adminService.getFlightInstanceById(flightInstanceId);
		} catch (error: any) {
			this.logger.error('Get flight instance error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to retrieve flight instance: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Put('flight-instances/:id')
	@Roles(SystemRole.ADMIN, SystemRole.SCHEDULE_PLANNER, SystemRole.FLIGHT_MANAGER, SystemRole.CALL_CENTER, SystemRole.OPERATIONS)
	@ApiOperation({
		summary: 'Update flight instance',
		description: 'Update flight instance details (aircraft, status, times). Requires ADMIN, FLIGHT_MANAGER, or OPERATIONS role.',
	})
	@ApiParam({
		name: 'id',
		description: 'Flight instance ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Flight instance updated successfully',
		type: FlightInstance,
	})
	async updateFlightInstance(
		@Param('id') flightInstanceId: string,
		@Body() dto: UpdateFlightInstanceDto,
	): Promise<FlightInstance> {
		try {
			return await this.adminService.updateFlightInstance(flightInstanceId, dto);
		} catch (error: any) {
			this.logger.error('Update flight instance error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to update flight instance: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Delete('flight-instances/:id')
	@Roles(SystemRole.ADMIN, SystemRole.SCHEDULE_PLANNER, SystemRole.FLIGHT_MANAGER)
	@ApiOperation({
		summary: 'Delete flight instance',
		description: 'Delete a flight instance. Requires ADMIN or FLIGHT_MANAGER role.',
	})
	@ApiParam({
		name: 'id',
		description: 'Flight instance ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Flight instance deleted successfully',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: true },
				message: { type: 'string', example: 'Flight instance deleted successfully' },
			},
		},
	})
	async deleteFlightInstance(@Param('id') flightInstanceId: string): Promise<{ success: boolean; message: string }> {
		try {
			return await this.adminService.deleteFlightInstance(flightInstanceId);
		} catch (error: any) {
			this.logger.error('Delete flight instance error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to delete flight instance: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	// ==================== USER ROLE MANAGEMENT ====================

	@Post('users/:userId/roles')
	@Roles(SystemRole.ADMIN)
	@ApiOperation({
		summary: 'Assign role to user',
		description: 'Assign a role to a user. Requires ADMIN role.',
	})
	@ApiParam({
		name: 'userId',
		description: 'User ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Role assigned successfully',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: true },
				message: { type: 'string', example: 'Role FARE_MANAGER assigned to user successfully' },
			},
		},
	})
	async assignRoleToUser(
		@Param('userId') userId: string,
		@Body() dto: Omit<AssignRoleDto, 'userId'>,
	): Promise<{ success: boolean; message: string }> {
		try {
			return await this.adminService.assignRoleToUser({ ...dto, userId });
		} catch (error: any) {
			this.logger.error('Assign role error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to assign role: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Delete('users/:userId/roles/:roleCode')
	@Roles(SystemRole.ADMIN)
	@ApiOperation({
		summary: 'Remove role from user',
		description: 'Remove a role from a user. Requires ADMIN role. Cannot remove CUSTOMER role.',
	})
	@ApiParam({
		name: 'userId',
		description: 'User ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiParam({
		name: 'roleCode',
		description: 'Role code',
		example: 'FARE_MANAGER',
	})
	@ApiOkResponse({
		description: 'Role removed successfully',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: true },
				message: { type: 'string', example: 'Role FARE_MANAGER removed from user successfully' },
			},
		},
	})
	async removeRoleFromUser(
		@Param('userId') userId: string,
		@Param('roleCode') roleCode: string,
	): Promise<{ success: boolean; message: string }> {
		try {
			return await this.adminService.removeRoleFromUser({ userId, roleCode: roleCode as SystemRole });
		} catch (error: any) {
			this.logger.error('Remove role error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to remove role: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Get('users/:userId/roles')
	@Roles(SystemRole.ADMIN)
	@ApiOperation({
		summary: 'Get user roles',
		description: 'Get all roles assigned to a user. Requires ADMIN role.',
	})
	@ApiParam({
		name: 'userId',
		description: 'User ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'User roles retrieved successfully',
		type: [Role],
	})
	async getUserRoles(@Param('userId') userId: string): Promise<Role[]> {
		try {
			return await this.adminService.getUserRoles(userId);
		} catch (error: any) {
			this.logger.error('Get user roles error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to retrieve user roles: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Get('roles')
	@Roles(SystemRole.ADMIN)
	@ApiOperation({
		summary: 'Get all roles',
		description: 'Get all available roles in the system. Requires ADMIN role.',
	})
	@ApiOkResponse({
		description: 'Roles retrieved successfully',
		type: [Role],
	})
	async getAllRoles(): Promise<Role[]> {
		try {
			return await this.adminService.getAllRoles();
		} catch (error: any) {
			this.logger.error('Get all roles error:', error);
			throw new InternalServerErrorException(
				`Failed to retrieve roles: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Get('users')
	@Roles(SystemRole.ADMIN)
	@ApiOperation({
		summary: 'Get all users',
		description: 'Get all users in the system with their roles. Requires ADMIN role.',
	})
	@ApiOkResponse({
		description: 'Users retrieved successfully',
		type: [User],
	})
	async getAllUsers(): Promise<User[]> {
		try {
			return await this.adminService.getAllUsers();
		} catch (error: any) {
			this.logger.error('Get all users error:', error);
			throw new InternalServerErrorException(
				`Failed to retrieve users: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Get('routes')
	@Roles(SystemRole.ADMIN, SystemRole.REVENUE_ANALYST, SystemRole.SCHEDULE_PLANNER, SystemRole.FLIGHT_MANAGER)
	@ApiOperation({
		summary: 'Get all routes',
		description: 'Get all routes in the system with airport information. Requires ADMIN, REVENUE_ANALYST, SCHEDULE_PLANNER, or FLIGHT_MANAGER role.',
	})
	@ApiOkResponse({
		description: 'Routes retrieved successfully',
		type: [Route],
	})
	async getAllRoutes(): Promise<Route[]> {
		try {
			return await this.adminService.getAllRoutes();
		} catch (error: any) {
			this.logger.error('Get all routes error:', error);
			throw new InternalServerErrorException(
				`Failed to retrieve routes: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	// ==================== ROUTE FARE PRICE MANAGEMENT (REVENUE_ANALYST) ====================

	@Post('route-fare-prices')
	@Roles(SystemRole.ADMIN, SystemRole.REVENUE_ANALYST)
	@ApiOperation({
		summary: 'Create a new route fare price',
		description: 'Create a new route fare price. Requires ADMIN or REVENUE_ANALYST role.',
	})
	@ApiOkResponse({
		description: 'Route fare price created successfully',
		type: RouteFarePrice,
	})
	@ApiBadRequestResponse({
		description: 'Invalid request or route/fare class not found',
	})
	async createRouteFarePrice(@Body() dto: CreateRouteFarePriceDto): Promise<RouteFarePrice> {
		try {
			return await this.adminService.createRouteFarePrice(dto);
		} catch (error: any) {
			this.logger.error('Create route fare price error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to create route fare price: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Get('route-fare-prices')
	@Roles(SystemRole.ADMIN, SystemRole.REVENUE_ANALYST, SystemRole.DISTRIBUTION_MANAGER)
	@ApiOperation({
		summary: 'Get all route fare prices with pagination',
		description: 'Get all route fare prices with pagination. Requires ADMIN, REVENUE_ANALYST, or DISTRIBUTION_MANAGER role. Supports pagination with page and limit query parameters.',
	})
	@ApiQuery({
		name: 'page',
		required: false,
		description: 'Page number (1-based)',
		example: 1,
		type: Number,
	})
	@ApiQuery({
		name: 'limit',
		required: false,
		description: 'Number of items per page. Allowed values: 20, 50, 100, 200',
		example: 20,
		type: Number,
		enum: [20, 50, 100, 200],
	})
	@ApiOkResponse({
		description: 'Route fare prices retrieved successfully',
		type: RouteFarePricesResponseDto,
	})
	async getAllRouteFarePrices(@Query() query: any): Promise<RouteFarePricesResponseDto> {
		try {
			// Manually parse and validate query parameters to ensure they're processed correctly
			const page = query.page ? Number(query.page) : 1;
			const limit = query.limit ? Number(query.limit) : 20;
			
			// Validate limit is one of allowed values
			const allowedLimits = [20, 50, 100, 200];
			const validLimit = allowedLimits.includes(limit) ? limit : 20;
			
			// Create DTO with validated values
			const dto: GetRouteFarePricesDto = {
				page: page,
				limit: validLimit,
			};
			
			return await this.adminService.getAllRouteFarePrices(dto);
		} catch (error: any) {
			this.logger.error('Get all route fare prices error:', error);
			throw new InternalServerErrorException(
				`Failed to retrieve route fare prices: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Get('route-fare-prices/:id')
	@Roles(SystemRole.ADMIN, SystemRole.REVENUE_ANALYST, SystemRole.DISTRIBUTION_MANAGER)
	@ApiOperation({
		summary: 'Get route fare price by ID',
		description: 'Get route fare price details by ID. Requires ADMIN, REVENUE_ANALYST, or DISTRIBUTION_MANAGER role.',
	})
	@ApiParam({
		name: 'id',
		description: 'Route fare price ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Route fare price retrieved successfully',
		type: RouteFarePrice,
	})
	async getRouteFarePriceById(@Param('id') routeFarePriceId: string): Promise<RouteFarePrice> {
		try {
			return await this.adminService.getRouteFarePriceById(routeFarePriceId);
		} catch (error: any) {
			this.logger.error('Get route fare price error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to retrieve route fare price: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Put('route-fare-prices/:id')
	@Roles(SystemRole.ADMIN, SystemRole.REVENUE_ANALYST)
	@ApiOperation({
		summary: 'Update route fare price',
		description: 'Update route fare price details. Requires ADMIN or REVENUE_ANALYST role.',
	})
	@ApiParam({
		name: 'id',
		description: 'Route fare price ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Route fare price updated successfully',
		type: RouteFarePrice,
	})
	async updateRouteFarePrice(
		@Param('id') routeFarePriceId: string,
		@Body() dto: UpdateRouteFarePriceDto,
	): Promise<RouteFarePrice> {
		try {
			return await this.adminService.updateRouteFarePrice(routeFarePriceId, dto);
		} catch (error: any) {
			this.logger.error('Update route fare price error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to update route fare price: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Delete('route-fare-prices/:id')
	@Roles(SystemRole.ADMIN, SystemRole.REVENUE_ANALYST)
	@ApiOperation({
		summary: 'Delete route fare price',
		description: 'Delete a route fare price. Requires ADMIN or REVENUE_ANALYST role.',
	})
	@ApiParam({
		name: 'id',
		description: 'Route fare price ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Route fare price deleted successfully',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: true },
				message: { type: 'string', example: 'Route fare price deleted successfully' },
			},
		},
	})
	async deleteRouteFarePrice(@Param('id') routeFarePriceId: string): Promise<{ success: boolean; message: string }> {
		try {
			return await this.adminService.deleteRouteFarePrice(routeFarePriceId);
		} catch (error: any) {
			this.logger.error('Delete route fare price error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to delete route fare price: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	// ==================== BAGGAGE ALLOWANCE MANAGEMENT (ANCILLARY_MANAGER) ====================

	@Post('baggage-allowances')
	@Roles(SystemRole.ADMIN, SystemRole.ANCILLARY_MANAGER)
	@ApiOperation({
		summary: 'Create a new baggage allowance',
		description: 'Create a new baggage allowance for a fare class. Requires ADMIN or ANCILLARY_MANAGER role.',
	})
	@ApiOkResponse({
		description: 'Baggage allowance created successfully',
		type: BaggageAllowance,
	})
	@ApiBadRequestResponse({
		description: 'Invalid request or fare class not found',
	})
	async createBaggageAllowance(@Body() dto: CreateBaggageAllowanceDto): Promise<BaggageAllowance> {
		try {
			return await this.adminService.createBaggageAllowance(dto);
		} catch (error: any) {
			this.logger.error('Create baggage allowance error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to create baggage allowance: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Get('baggage-allowances')
	@Roles(SystemRole.ADMIN, SystemRole.ANCILLARY_MANAGER, SystemRole.CALL_CENTER, SystemRole.DISTRIBUTION_MANAGER)
	@ApiOperation({
		summary: 'Get all baggage allowances with pagination',
		description: 'Get paginated baggage allowances. Requires ADMIN, ANCILLARY_MANAGER, CALL_CENTER, or DISTRIBUTION_MANAGER role. Supports pagination with page and limit query parameters.',
	})
	@ApiOkResponse({
		description: 'Baggage allowances retrieved successfully',
		type: BaggageAllowancesResponseDto,
	})
	async getAllBaggageAllowances(@Query() query: GetBaggageAllowancesDto): Promise<BaggageAllowancesResponseDto> {
		try {
			return await this.adminService.getAllBaggageAllowances(query);
		} catch (error: any) {
			this.logger.error('Get all baggage allowances error:', error);
			throw new InternalServerErrorException(
				`Failed to retrieve baggage allowances: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Get('baggage-allowances/:id')
	@Roles(SystemRole.ADMIN, SystemRole.ANCILLARY_MANAGER, SystemRole.CALL_CENTER, SystemRole.DISTRIBUTION_MANAGER)
	@ApiOperation({
		summary: 'Get baggage allowance by ID',
		description: 'Get baggage allowance details by ID. Requires ADMIN, ANCILLARY_MANAGER, CALL_CENTER, or DISTRIBUTION_MANAGER role.',
	})
	@ApiParam({
		name: 'id',
		description: 'Baggage allowance ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Baggage allowance retrieved successfully',
		type: BaggageAllowance,
	})
	async getBaggageAllowanceById(@Param('id') baggageAllowanceId: string): Promise<BaggageAllowance> {
		try {
			return await this.adminService.getBaggageAllowanceById(baggageAllowanceId);
		} catch (error: any) {
			this.logger.error('Get baggage allowance error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to retrieve baggage allowance: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Put('baggage-allowances/:id')
	@Roles(SystemRole.ADMIN, SystemRole.ANCILLARY_MANAGER)
	@ApiOperation({
		summary: 'Update baggage allowance',
		description: 'Update baggage allowance details. Requires ADMIN or ANCILLARY_MANAGER role.',
	})
	@ApiParam({
		name: 'id',
		description: 'Baggage allowance ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Baggage allowance updated successfully',
		type: BaggageAllowance,
	})
	async updateBaggageAllowance(
		@Param('id') baggageAllowanceId: string,
		@Body() dto: UpdateBaggageAllowanceDto,
	): Promise<BaggageAllowance> {
		try {
			return await this.adminService.updateBaggageAllowance(baggageAllowanceId, dto);
		} catch (error: any) {
			this.logger.error('Update baggage allowance error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to update baggage allowance: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Delete('baggage-allowances/:id')
	@Roles(SystemRole.ADMIN, SystemRole.ANCILLARY_MANAGER)
	@ApiOperation({
		summary: 'Delete baggage allowance',
		description: 'Delete a baggage allowance. Requires ADMIN or ANCILLARY_MANAGER role.',
	})
	@ApiParam({
		name: 'id',
		description: 'Baggage allowance ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Baggage allowance deleted successfully',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: true },
				message: { type: 'string', example: 'Baggage allowance deleted successfully' },
			},
		},
	})
	async deleteBaggageAllowance(@Param('id') baggageAllowanceId: string): Promise<{ success: boolean; message: string }> {
		try {
			return await this.adminService.deleteBaggageAllowance(baggageAllowanceId);
		} catch (error: any) {
			this.logger.error('Delete baggage allowance error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to delete baggage allowance: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	// ==================== CABIN SERVICE MANAGEMENT (ANCILLARY_MANAGER) ====================

	@Post('cabin-services')
	@Roles(SystemRole.ADMIN, SystemRole.ANCILLARY_MANAGER)
	@ApiOperation({
		summary: 'Create a new cabin service',
		description: 'Create a new cabin service. Requires ADMIN or ANCILLARY_MANAGER role.',
	})
	@ApiOkResponse({
		description: 'Cabin service created successfully',
		type: CabinService,
	})
	@ApiBadRequestResponse({
		description: 'Invalid request or cabin/fare class not found',
	})
	async createCabinService(@Body() dto: CreateCabinServiceDto): Promise<CabinService> {
		try {
			return await this.adminService.createCabinService(dto);
		} catch (error: any) {
			this.logger.error('Create cabin service error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to create cabin service: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Get('cabin-services')
	@Roles(SystemRole.ADMIN, SystemRole.ANCILLARY_MANAGER, SystemRole.CALL_CENTER, SystemRole.DISTRIBUTION_MANAGER)
	@ApiOperation({
		summary: 'Get all cabin services',
		description: 'Get all cabin services. Requires ADMIN, ANCILLARY_MANAGER, CALL_CENTER, or DISTRIBUTION_MANAGER role.',
	})
	@ApiOkResponse({
		description: 'Cabin services retrieved successfully',
		type: [CabinService],
	})
	async getAllCabinServices(): Promise<CabinService[]> {
		try {
			return await this.adminService.getAllCabinServices();
		} catch (error: any) {
			this.logger.error('Get all cabin services error:', error);
			throw new InternalServerErrorException(
				`Failed to retrieve cabin services: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Get('cabin-services/:id')
	@Roles(SystemRole.ADMIN, SystemRole.ANCILLARY_MANAGER, SystemRole.CALL_CENTER, SystemRole.DISTRIBUTION_MANAGER)
	@ApiOperation({
		summary: 'Get cabin service by ID',
		description: 'Get cabin service details by ID. Requires ADMIN, ANCILLARY_MANAGER, CALL_CENTER, or DISTRIBUTION_MANAGER role.',
	})
	@ApiParam({
		name: 'id',
		description: 'Cabin service ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Cabin service retrieved successfully',
		type: CabinService,
	})
	async getCabinServiceById(@Param('id') cabinServiceId: string): Promise<CabinService> {
		try {
			return await this.adminService.getCabinServiceById(cabinServiceId);
		} catch (error: any) {
			this.logger.error('Get cabin service error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to retrieve cabin service: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Put('cabin-services/:id')
	@Roles(SystemRole.ADMIN, SystemRole.ANCILLARY_MANAGER)
	@ApiOperation({
		summary: 'Update cabin service',
		description: 'Update cabin service details. Requires ADMIN or ANCILLARY_MANAGER role.',
	})
	@ApiParam({
		name: 'id',
		description: 'Cabin service ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Cabin service updated successfully',
		type: CabinService,
	})
	async updateCabinService(
		@Param('id') cabinServiceId: string,
		@Body() dto: UpdateCabinServiceDto,
	): Promise<CabinService> {
		try {
			return await this.adminService.updateCabinService(cabinServiceId, dto);
		} catch (error: any) {
			this.logger.error('Update cabin service error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to update cabin service: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Delete('cabin-services/:id')
	@Roles(SystemRole.ADMIN, SystemRole.ANCILLARY_MANAGER)
	@ApiOperation({
		summary: 'Delete cabin service',
		description: 'Delete a cabin service. Requires ADMIN or ANCILLARY_MANAGER role.',
	})
	@ApiParam({
		name: 'id',
		description: 'Cabin service ID (UUID v7)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Cabin service deleted successfully',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: true },
				message: { type: 'string', example: 'Cabin service deleted successfully' },
			},
		},
	})
	async deleteCabinService(@Param('id') cabinServiceId: string): Promise<{ success: boolean; message: string }> {
		try {
			return await this.adminService.deleteCabinService(cabinServiceId);
		} catch (error: any) {
			this.logger.error('Delete cabin service error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to delete cabin service: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	// ==================== FARE DESCRIPTION RULE MANAGEMENT ====================

	@Post('fare-description-rules')
	@Roles(SystemRole.ADMIN, SystemRole.ANCILLARY_MANAGER)
	@ApiOperation({
		summary: 'Create a new fare description rule',
		description: 'Create a new fare description rule. Requires ADMIN or ANCILLARY_MANAGER role.',
	})
	@ApiOkResponse({
		description: 'Fare description rule created successfully',
		type: FareDescriptionRule,
	})
	@ApiBadRequestResponse({
		description: 'Invalid request',
	})
	async createFareDescriptionRule(@Body() dto: CreateFareDescriptionRuleDto): Promise<FareDescriptionRule> {
		try {
			return await this.adminService.createFareDescriptionRule(dto);
		} catch (error: any) {
			this.logger.error('Create fare description rule error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to create fare description rule: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Get('fare-description-rules')
	@Roles(SystemRole.ADMIN, SystemRole.ANCILLARY_MANAGER, SystemRole.CALL_CENTER, SystemRole.DISTRIBUTION_MANAGER)
	@ApiOperation({
		summary: 'Get all fare description rules',
		description: 'Get all fare description rules. Requires ADMIN, ANCILLARY_MANAGER, CALL_CENTER, or DISTRIBUTION_MANAGER role.',
	})
	@ApiOkResponse({
		description: 'Fare description rules retrieved successfully',
		type: [FareDescriptionRule],
	})
	async getAllFareDescriptionRules(): Promise<FareDescriptionRule[]> {
		try {
			return await this.adminService.getAllFareDescriptionRules();
		} catch (error: any) {
			this.logger.error('Get all fare description rules error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to get fare description rules: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Get('fare-description-rules/:id')
	@Roles(SystemRole.ADMIN, SystemRole.ANCILLARY_MANAGER, SystemRole.CALL_CENTER, SystemRole.DISTRIBUTION_MANAGER)
	@ApiOperation({
		summary: 'Get fare description rule by ID',
		description: 'Get fare description rule details by ID. Requires ADMIN, ANCILLARY_MANAGER, CALL_CENTER, or DISTRIBUTION_MANAGER role.',
	})
	@ApiParam({
		name: 'id',
		description: 'Fare description rule ID (UUID)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Fare description rule retrieved successfully',
		type: FareDescriptionRule,
	})
	@ApiBadRequestResponse({
		description: 'Fare description rule not found',
	})
	async getFareDescriptionRuleById(@Param('id') ruleId: string): Promise<FareDescriptionRule> {
		try {
			return await this.adminService.getFareDescriptionRuleById(ruleId);
		} catch (error: any) {
			this.logger.error('Get fare description rule by ID error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to get fare description rule: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Put('fare-description-rules/:id')
	@Roles(SystemRole.ADMIN, SystemRole.ANCILLARY_MANAGER)
	@ApiOperation({
		summary: 'Update fare description rule',
		description: 'Update fare description rule. Requires ADMIN or ANCILLARY_MANAGER role.',
	})
	@ApiParam({
		name: 'id',
		description: 'Fare description rule ID (UUID)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Fare description rule updated successfully',
		type: FareDescriptionRule,
	})
	@ApiBadRequestResponse({
		description: 'Invalid request or fare description rule not found',
	})
	async updateFareDescriptionRule(
		@Param('id') ruleId: string,
		@Body() dto: UpdateFareDescriptionRuleDto,
	): Promise<FareDescriptionRule> {
		try {
			return await this.adminService.updateFareDescriptionRule(ruleId, dto);
		} catch (error: any) {
			this.logger.error('Update fare description rule error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to update fare description rule: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}

	@Delete('fare-description-rules/:id')
	@Roles(SystemRole.ADMIN, SystemRole.ANCILLARY_MANAGER)
	@ApiOperation({
		summary: 'Delete fare description rule',
		description: 'Delete fare description rule. Requires ADMIN or ANCILLARY_MANAGER role.',
	})
	@ApiParam({
		name: 'id',
		description: 'Fare description rule ID (UUID)',
		example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
	})
	@ApiOkResponse({
		description: 'Fare description rule deleted successfully',
		schema: {
			type: 'object',
			properties: {
				success: { type: 'boolean', example: true },
				message: { type: 'string', example: 'Fare description rule deleted successfully' },
			},
		},
	})
	async deleteFareDescriptionRule(@Param('id') ruleId: string): Promise<{ success: boolean; message: string }> {
		try {
			return await this.adminService.deleteFareDescriptionRule(ruleId);
		} catch (error: any) {
			this.logger.error('Delete fare description rule error:', error);
			if (error?.statusCode && error?.message) {
				throw error;
			}
			throw new BadRequestException(
				`Failed to delete fare description rule: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`,
			);
		}
	}
}

