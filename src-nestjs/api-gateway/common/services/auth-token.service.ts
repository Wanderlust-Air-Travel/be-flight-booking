import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import type { StringValue } from 'ms';
import { User } from 'src/api-gateway/data-access/entities/user/user.entity';
import type { TokenPayload } from 'src/shared/types/auth/token-payload';
import type { Repository } from 'typeorm';

/**
 * Shared token issuance helpers used by both AuthService and DevService.
 *
 * Keeps JWT signing + refresh-token persistence in a single place so the dev
 * login flow can mint a real session without duplicating secret/expiry logic.
 */
@Injectable()
export class AuthTokenService {
    constructor(
        private readonly jwt: JwtService,
        @InjectRepository(User)
        private readonly usersRepo: Repository<User>
    ) {}

    async issueTokens(
        userId: string,
        email: string
    ): Promise<{ access_token: string; refresh_token: string }> {
        const payload: TokenPayload = { sub: userId, email };
        const accessToken = await this.jwt.signAsync(payload);

        const refreshToken = await this.jwt.signAsync(payload, {
            secret: process.env.JWT_REFRESH_SECRET as string,
            expiresIn: (process.env.JWT_REFRESH_EXPIRES ?? '7d') as StringValue,
        });

        return { access_token: accessToken, refresh_token: refreshToken };
    }

    async saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
        const hash = await bcrypt.hash(refreshToken, 10);
        await this.usersRepo.update({ user_id: userId }, { refresh_token: hash });
    }
}
