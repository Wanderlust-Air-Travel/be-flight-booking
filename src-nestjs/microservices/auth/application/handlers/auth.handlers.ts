import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';

export interface LoginCommand {
    email: string;
    password: string;
}

export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; roles: string[] };
}

export interface RefreshTokenCommand {
    refreshToken: string;
}

export interface RefreshTokenResponse {
    accessToken: string;
}

export interface IAuthPort {
    login(email: string, password: string): Promise<LoginResponse | null>;
    refresh(refreshToken: string): Promise<{ accessToken: string } | null>;
}

/**
 * LoginHandler — Auth use case.
 *
 * Delegates password verification to IAuthPort (which wraps DB + bcrypt).
 * Returns JWT tokens on success; throws Unauthorized on failure.
 */
@Injectable()
export class LoginHandler {
    constructor(@Inject('IAuthPort') private readonly port: IAuthPort) {}

    async execute(command: LoginCommand): Promise<LoginResponse> {
        if (!command.email || !command.password) {
            throw new UnauthorizedException('Missing credentials');
        }
        const result = await this.port.login(command.email, command.password);
        if (!result) {
            throw new UnauthorizedException('Invalid credentials');
        }
        return result;
    }
}

@Injectable()
export class RefreshTokenHandler {
    constructor(@Inject('IAuthPort') private readonly port: IAuthPort) {}

    async execute(command: RefreshTokenCommand): Promise<RefreshTokenResponse> {
        if (!command.refreshToken) {
            throw new UnauthorizedException('Missing refresh token');
        }
        const result = await this.port.refresh(command.refreshToken);
        if (!result) {
            throw new UnauthorizedException('Invalid refresh token');
        }
        return result;
    }
}
