import { Body, Controller, Get, Post, Req, UseGuards, HttpCode, HttpStatus } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./guard/jwt-auth.guard";
import { RefreshDto } from "./dto/refresh.dto";
import { LogoutDto } from "./dto/logout.dto";
import { SendOtpPaymentDto } from "./dto/send-otp-payment.dto";
import { VerifyOtpPaymentDto } from "./dto/verify-otp-payment.dto";
import { SendOtpPasswordResetDto } from "./dto/send-otp-password-reset.dto";
import { VerifyOtpPasswordResetDto } from "./dto/verify-otp-password-reset.dto";
import { SendOtpCancellationDto } from "./dto/send-otp-cancellation.dto";
import { VerifyOtpCancellationDto } from "./dto/verify-otp-cancellation.dto";
import type { Request } from 'express';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { CreateUserResponse } from "src/shared/types/auth/create-user-response";
import { LoginResponse } from "src/shared/types/auth/login-response";
import { TokensResponse } from "src/shared/types/auth/tokens-response";
import { LogoutResponse } from "src/shared/types/auth/logout-response";

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
    @HttpCode(HttpStatus.OK)
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
    refresh(@Body() body: RefreshDto) {
        return this.auth.refresh(body.userId, body.refresh_token);
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
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
    async me(@Req() req: Request & { user: { userId: string; email: string } }) {
        return await this.auth.getUserWithRoles(req.user.userId);
    }

    @Post('otp/payment/send')
    @HttpCode(HttpStatus.OK)
    @ApiBody({
        type: SendOtpPaymentDto,
        examples: {
            default: {
                summary: 'Send OTP for payment',
                value: {
                    userId: '019a8f4a-bb0e-7402-a0c4-27647b89dc71'
                }
            }
        }
    })
    @ApiOkResponse({
        description: 'OTP sent successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'OTP sent successfully' },
                expiresIn: { type: 'number', example: 900 }
            }
        }
    })
    sendOtpPayment(@Body() dto: SendOtpPaymentDto) {
        return this.auth.sendOtpPayment(dto);
    }

    @Post('otp/payment/verify')
    @HttpCode(HttpStatus.OK)
    @ApiBody({
        type: VerifyOtpPaymentDto,
        examples: {
            default: {
                summary: 'Verify OTP for payment',
                value: {
                    userId: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
                    otp: '123456'
                }
            }
        }
    })
    @ApiOkResponse({
        description: 'OTP verified successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'OTP verified successfully' }
            }
        }
    })
    verifyOtpPayment(@Body() dto: VerifyOtpPaymentDto) {
        return this.auth.verifyOtpPayment(dto);
    }

    @Post('otp/password-reset/send')
    @HttpCode(HttpStatus.OK)
    @ApiBody({
        type: SendOtpPasswordResetDto,
        examples: {
            default: {
                summary: 'Send OTP for password reset',
                value: {
                    email: 'user@example.com'
                }
            }
        }
    })
    @ApiOkResponse({
        description: 'OTP sent successfully (always returns success for security)',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'If the email exists, an OTP has been sent' },
                expiresIn: { type: 'number', example: 600 }
            }
        }
    })
    sendOtpPasswordReset(@Body() dto: SendOtpPasswordResetDto) {
        return this.auth.sendOtpPasswordReset(dto);
    }

    @Post('otp/password-reset/verify')
    @HttpCode(HttpStatus.OK)
    @ApiBody({
        type: VerifyOtpPasswordResetDto,
        examples: {
            default: {
                summary: 'Verify OTP and reset password',
                value: {
                    email: 'user@example.com',
                    otp: '123456',
                    newPassword: 'NewStrongP@ssw0rd'
                }
            }
        }
    })
    @ApiOkResponse({
        description: 'Password reset successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Password reset successfully' }
            }
        }
    })
    verifyOtpPasswordReset(@Body() dto: VerifyOtpPasswordResetDto) {
        return this.auth.verifyOtpPasswordReset(dto);
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @Post('otp/cancellation/send')
    @HttpCode(HttpStatus.OK)
    @ApiBody({
        type: SendOtpCancellationDto,
        examples: {
            default: {
                summary: 'Send OTP for cancellation',
                value: {
                    userId: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
                    bookingId: '019a8f4a-bb0e-7402-a0c4-27647b89dc72'
                }
            }
        }
    })
    @ApiOkResponse({
        description: 'OTP sent successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'OTP sent successfully' },
                expiresIn: { type: 'number', example: 900 }
            }
        }
    })
    sendOtpCancellation(@Body() dto: SendOtpCancellationDto) {
        return this.auth.sendOtpCancellation(dto);
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @Post('otp/cancellation/verify')
    @HttpCode(HttpStatus.OK)
    @ApiBody({
        type: VerifyOtpCancellationDto,
        examples: {
            default: {
                summary: 'Verify OTP for cancellation',
                value: {
                    userId: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
                    bookingId: '019a8f4a-bb0e-7402-a0c4-27647b89dc72',
                    otp: '123456'
                }
            }
        }
    })
    @ApiOkResponse({
        description: 'OTP verified successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'OTP verified successfully' }
            }
        }
    })
    verifyOtpCancellation(@Body() dto: VerifyOtpCancellationDto) {
        return this.auth.verifyOtpCancellation(dto);
    }
}