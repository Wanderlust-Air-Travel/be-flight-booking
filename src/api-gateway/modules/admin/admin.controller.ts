import {
	Controller,
	Get,
	Post,
	Put,
	Delete,
	Body,
	Param,
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
import { CreateFlightInstanceDto } from './dto/create-flight-instance.dto';
import { UpdateFlightInstanceDto } from './dto/update-flight-instance.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { RemoveRoleDto } from './dto/remove-role.dto';
import { FareClass } from 'src/shared/entities/fare/fare-class.entity';
import { FlightSchedule } from 'src/shared/entities/flight/flight-schedule.entity';
import { FlightInstance } from 'src/shared/entities/flight/flight-instance.entity';
import { Role } from 'src/shared/entities/role/role.entity';
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
		type: FlightSchedule,
	})
	@ApiBadRequestResponse({
		description: 'Invalid request or overlapping schedule exists',
	})
	async createFlightSchedule(@Body() dto: CreateFlightScheduleDto): Promise<FlightSchedule> {
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
		type: [FlightSchedule],
	})
	async getAllFlightSchedules(): Promise<FlightSchedule[]> {
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
		type: FlightSchedule,
	})
	async getFlightScheduleById(@Param('id') flightScheduleId: string): Promise<FlightSchedule> {
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
		type: FlightSchedule,
	})
	async updateFlightSchedule(
		@Param('id') flightScheduleId: string,
		@Body() dto: UpdateFlightScheduleDto,
	): Promise<FlightSchedule> {
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
}

