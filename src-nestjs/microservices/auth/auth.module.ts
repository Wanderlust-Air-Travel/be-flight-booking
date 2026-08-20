import { Module } from '@nestjs/common';
import { LoginHandler, RefreshTokenHandler } from './application/handlers/auth.handlers';
import { AuthMessageHandler } from './interface/auth.message-handler';

@Module({
    controllers: [AuthMessageHandler],
    providers: [LoginHandler, RefreshTokenHandler],
})
export class AuthModule {}