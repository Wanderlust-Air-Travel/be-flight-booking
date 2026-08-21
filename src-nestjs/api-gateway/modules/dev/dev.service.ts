import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthTokenService } from 'src/api-gateway/common/services/auth-token.service';
import { Role } from 'src/api-gateway/data-access/entities/role/role.entity';
import { User } from 'src/api-gateway/data-access/entities/user/user.entity';
import { AUTH_MESSAGES } from 'src/shared/constants/messages';
import { SystemRole } from 'src/shared/constants/roles';
import type { LoginResponse } from 'src/shared/types/auth/login-response';
import type { Repository } from 'typeorm';
import type { DevAccountDto } from './dto/dev-account.dto';

// Roles surfaced in the dev panel. Legacy aliases are intentionally excluded
// so the panel only shows the canonical 10 roles seeded by the reference seed.
const DEVISABLE_ROLES: SystemRole[] = [
    SystemRole.CUSTOMER,
    SystemRole.TRAVEL_AGENT,
    SystemRole.SCHEDULE_PLANNER,
    SystemRole.REVENUE_ANALYST,
    SystemRole.ANCILLARY_MANAGER,
    SystemRole.CALL_CENTER,
    SystemRole.ADMIN,
    SystemRole.ACCOUNTING_STAFF,
    SystemRole.DISTRIBUTION_MANAGER,
    SystemRole.FRAUD_ANALYST,
];

interface RawAccountRow {
    user_id: string;
    email: string;
    fullname: string;
    role_code: string;
    role_name: string;
    role_description: string | null;
}

@Injectable()
export class DevService {
    constructor(
        @InjectRepository(User)
        private readonly usersRepo: Repository<User>,
        @InjectRepository(Role)
        private readonly rolesRepo: Repository<Role>,
        private readonly authTokenService: AuthTokenService
    ) {}

    /**
     * Return one user per dev-facing role.
     *
     * Priority:
     *   1. The seeded user matching `{role_lowercase}@flightbooking.com`.
     *   2. Otherwise the first active user assigned to that role.
     *
     * Roles without any active user are silently skipped.
     */
    async listAccounts(): Promise<DevAccountDto[]> {
        const rows = await this.usersRepo
            .createQueryBuilder('u')
            .innerJoin('UserRoles', 'ur', 'ur.user_id = u.user_id')
            .innerJoin(Role, 'r', 'r.role_code = ur.role_code')
            .select([
                'u.user_id AS user_id',
                'u.email AS email',
                'u.fullname AS fullname',
                'ur.role_code AS role_code',
                'r.name AS role_name',
                'r.description AS role_description',
            ])
            .where('u.is_active = :active', { active: true })
            .andWhere('r.is_active = :active', { active: true })
            .orderBy('u.created_at', 'ASC')
            .getRawMany<RawAccountRow>();

        const byRole = new Map<string, RawAccountRow[]>();
        for (const row of rows) {
            const list = byRole.get(row.role_code) ?? [];
            list.push(row);
            byRole.set(row.role_code, list);
        }

        const accounts: DevAccountDto[] = [];
        for (const role of DEVISABLE_ROLES) {
            const candidates = byRole.get(role) ?? [];
            if (candidates.length === 0) continue;

            const seedMatch = candidates.find((row) =>
                row.email.toLowerCase().endsWith('@flightbooking.com')
            );
            const picked = seedMatch ?? candidates[0];

            accounts.push({
                userId: picked.user_id,
                email: picked.email,
                fullname: picked.fullname,
                roleCode: role,
                roleName: picked.role_name,
                roleDescription: picked.role_description,
            });
        }

        return accounts;
    }

    /**
     * Issue a real session for the given email without checking the password.
     *
     * Used by the FE dev panel only — the controller enforces NODE_ENV and
     * DEV_LOGIN_ENABLED so this method can never be reached in production.
     */
    async loginByEmail(email: string): Promise<LoginResponse> {
        const user = await this.usersRepo.findOne({ where: { email } });
        if (!user) {
            throw new NotFoundException(AUTH_MESSAGES.ERROR.USER_NOT_FOUND);
        }

        const tokens = await this.authTokenService.issueTokens(user.user_id, user.email);
        await this.authTokenService.saveRefreshToken(user.user_id, tokens.refresh_token);

        return {
            user: {
                id: user.user_id,
                email: user.email,
                fullname: user.fullname,
                phone: user.phone,
            },
            ...tokens,
        };
    }
}
