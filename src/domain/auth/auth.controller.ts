import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./guard/jwt-auth.guard";
import { RefreshDto } from "./dto/refresh.dto";
import { LogoutDto } from "./dto/logout.dto";
import type { Request } from 'express';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { CreateUserResponse } from "../../types/auth/create-user-response";
import { LoginResponse } from "../../types/auth/login-response";
import { TokensResponse } from "../../types/auth/tokens-response";
import { LogoutResponse } from "../../types/auth/logout-response";

@ApiTags('auth')
@Controller('auth')
export class AuthController{
    constructor(private readonly auth: AuthService) {}

    @Post('register')
    @ApiBody({
        type: RegisterDto,
        examples: {
            default: {
                summary: 'Valid payload',
                value: {
                    fullname: 'Nguyen Van A',
                    email: 'user@example.com',
                    password: 'StrongP@ssw0rd',
                    phone: '0901234567'
                }
            }
        }
    })
    @ApiCreatedResponse({ type: CreateUserResponse, description: 'User registered successfully' })
    register(@Body() dto: RegisterDto) {
        return this.auth.register(dto);
    }

    @Post('login')
    @ApiBody({
        type: LoginDto,
        examples: {
            default: {
                summary: 'Login with email/password',
                value: {
                    email: 'user@example.com',
                    password: 'StrongP@ssw0rd'
                }
            }
        }
    })
    @ApiOkResponse({ type: LoginResponse, description: 'Login successful' })
    login (@Body() dto: LoginDto) {
        return this.auth.login(dto);
    }

    @Post('refresh')
    @ApiBody({ type: RefreshDto, examples: {
        default: {
            summary: 'Refresh tokens',
            value: {
                userId: 'a3f1f8e6-5a6b-4b2d-9f1a-2c3d4e5f6a7b',
                refresh_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            }
        }
    }})
    @ApiOkResponse({ type: TokensResponse, description: 'New tokens issued' })
    refesh(@Body() body: RefreshDto) {
        return this.auth.refresh(body.userId, body.refresh_token);
    }

    @Post('logout')
    @ApiBody({ type: LogoutDto, examples: {
        default: {
            summary: 'Logout by user id',
            value: {
                userId: 'a3f1f8e6-5a6b-4b2d-9f1a-2c3d4e5f6a7b'
            }
        }
    }})
    @ApiOkResponse({ type: LogoutResponse, description: 'Logout success' })
    logout(@Body() body: LogoutDto) {
        return this.auth.logout(body.userId);
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @Get('me')
    me(@Req() req: Request & { user: Express.User }) {
        return req.user;
    }
}