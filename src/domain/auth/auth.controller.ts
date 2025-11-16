import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./guard/jwt-auth.guard";
import type { Request } from 'express';

@Controller('auth')
export class AuthController{
    constructor(private readonly auth: AuthService) {}

    @Post('register')
    register(@Body() dto: RegisterDto) {
        return this.auth.register(dto);
    }

    @Post('login')
    login (@Body() dto: LoginDto) {
        return this.auth.login(dto);
    }

    @Post('refresh')
    refesh(@Body() body: { userId: string, refresh_token: string }) {
        return this.auth.refresh(body.userId, body.refresh_token);
    }

    @Post('logout')
    logout(@Body() body: { userId: string }) {
        return this.auth.logout(body.userId);
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    me(@Req() req: Request) {
        return req.user;
    }
}