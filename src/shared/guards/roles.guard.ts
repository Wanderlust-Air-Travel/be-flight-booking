import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemRole, ROLE_PERMISSIONS } from '../constants/roles';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user/user.entity';
import { UserRole } from '../entities/user/user-role.entity';
import { Role } from '../entities/role/role.entity';

/**
 * Roles Guard
 * Checks if the authenticated user has the required role(s)
 * 
 * Usage:
 * @Roles(SystemRole.ADMIN, SystemRole.FARE_MANAGER)
 * @UseGuards(JwtAuthGuard, RolesGuard)
 */
@Injectable()
export class RolesGuard implements CanActivate {
	private readonly logger = new Logger(RolesGuard.name);

	constructor(
		private reflector: Reflector,
		@InjectRepository(User) private readonly userRepo: Repository<User>,
		@InjectRepository(UserRole) private readonly userRoleRepo: Repository<UserRole>,
		@InjectRepository(Role) private readonly roleRepo: Repository<Role>,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		// Get required roles from decorator
		const requiredRoles = this.reflector.getAllAndOverride<SystemRole[]>(ROLES_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		// If no roles required, allow access
		if (!requiredRoles || requiredRoles.length === 0) {
			return true;
		}

		// Get user from request (set by JwtAuthGuard)
		const request = context.switchToHttp().getRequest();
		const user = request.user;

		if (!user || !user.userId) {
			this.logger.warn('RolesGuard: No user found in request');
			throw new ForbiddenException('Authentication required');
		}

		// Get user roles from database
		const userRoles = await this.userRoleRepo.find({
			where: { user_id: user.userId },
			relations: ['role'],
		});

		// Extract role codes
		const userRoleCodes = userRoles
			.map(ur => ur.role?.role_code)
			.filter((code): code is string => !!code);

		// Check if user has ADMIN role (admin has all permissions)
		if (userRoleCodes.includes(SystemRole.ADMIN)) {
			this.logger.log(`User ${user.userId} has ADMIN role, granting access`);
			return true;
		}

		// Check if user has any of the required roles
		const hasRequiredRole = requiredRoles.some(role => userRoleCodes.includes(role));

		if (!hasRequiredRole) {
			this.logger.warn(
				`User ${user.userId} does not have required roles. Required: ${requiredRoles.join(', ')}, Has: ${userRoleCodes.join(', ') || 'none'}`,
			);
			throw new ForbiddenException(
				`Access denied. Required roles: ${requiredRoles.join(', ')}`,
			);
		}

		this.logger.log(`User ${user.userId} has required role(s), granting access`);
		return true;
	}
}

