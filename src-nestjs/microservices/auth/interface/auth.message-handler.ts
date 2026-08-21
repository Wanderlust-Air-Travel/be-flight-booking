import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import type { LoginHandler, RefreshTokenHandler } from '../application/handlers/auth.handlers';

@Controller()
export class AuthMessageHandler {
    constructor(
        private readonly loginHandler: LoginHandler,
        private readonly refreshHandler: RefreshTokenHandler
    ) {}

    @MessagePattern('auth_login')
    async login(payload: any): Promise<any> {
        return this.loginHandler.execute(payload);
    }

    @MessagePattern('auth_refresh_token')
    async refresh(payload: any): Promise<any> {
        return this.refreshHandler.execute(payload);
    }
}
