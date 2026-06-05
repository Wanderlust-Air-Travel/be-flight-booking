import {
    BadRequestException,
    ConflictException,
    Inject,
    Injectable,
    Logger,
    NotFoundException,
    ServiceUnavailableException,
    UnauthorizedException,
} from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import type { StringValue } from 'ms';
import { firstValueFrom } from 'rxjs';
import { EMAIL_MS } from 'src/microservices/email/email.messages';
import { EmailTemplate } from 'src/shared/constants/enums';
import { AUTH_MESSAGES } from 'src/shared/constants/messages';
import { Role } from 'src/shared/entities/role/role.entity';
import { User } from 'src/shared/entities/user/user.entity';
import type { OtpStorageService } from 'src/shared/services/otp-storage.service';
import type { CreateUserResponse } from 'src/shared/types/auth/create-user-response';
import type { LoginResponse } from 'src/shared/types/auth/login-response';
import type { LogoutResponse } from 'src/shared/types/auth/logout-response';
import type { TokenPayload } from 'src/shared/types/auth/token-payload';
import type { TokensResponse } from 'src/shared/types/auth/tokens-response';
import type { Repository } from 'typeorm';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - uuid package is ESM but works fine with CommonJS
import { v7 as uuidv7 } from 'uuid';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { SendOtpCancellationDto } from './dto/send-otp-cancellation.dto';
import type { SendOtpPasswordResetDto } from './dto/send-otp-password-reset.dto';
import type { SendOtpPaymentDto } from './dto/send-otp-payment.dto';
import type { VerifyOtpCancellationDto } from './dto/verify-otp-cancellation.dto';
import type { VerifyOtpPasswordResetDto } from './dto/verify-otp-password-reset.dto';
import type { VerifyOtpPaymentDto } from './dto/verify-otp-payment.dto';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        @InjectRepository(User)
        private readonly _usersRepo: Repository<User>,
        @InjectRepository(Role)
        private readonly _roleRepo: Repository<Role>,
        private readonly jwt: JwtService,
        @Inject('EMAIL_CLIENT') private readonly _emailClient: ClientProxy,
        private readonly otpStorageService: OtpStorageService
    ) {}

    private get usersRepo(): Repository<User> {
        return this._usersRepo;
    }

    private get roleRepo(): Repository<Role> {
        return this._roleRepo;
    }

    /**
        const existed = await this.usersRepo.findOne({ where: { email: data.email } });
        if (existed) {
            throw new ConflictException(AUTH_MESSAGES.ERROR.EMAIL_ALREADY_EXISTS);
        }

        const passwordHash = await bcrypt.hash(data.password, 10);
        const user = this.usersRepo.create({
            user_id: uuidv7(), // Generate UUID v7 for user_id
            fullname: data.fullname,
            password_hash: passwordHash,
            email: data.email,
            phone: data.phone,
        });
        await this.usersRepo.save(user);

        const tokens = await this.issueTokens(user.user_id, user.email);

        // Lưu refresh token (hash) vào DB nếu muốn quản lý phiên
        await this.saveRefreshToken(user.user_id, tokens.refresh_token);
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

    async login(data: LoginDto): Promise<LoginResponse> {
        const user = await this.usersRepo.findOne({ where: { email: data.email } });
        if (!user) throw new UnauthorizedException(AUTH_MESSAGES.ERROR.INVALID_CREDENTIALS);

        const ok = await bcrypt.compare(data.password, user.password_hash);
        if (!ok) throw new UnauthorizedException(AUTH_MESSAGES.ERROR.INVALID_CREDENTIALS);

        const tokens = await this.issueTokens(user.user_id, user.email);
        await this.saveRefreshToken(user.user_id, tokens.refresh_token);

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

    async refresh(userId: string, refreshToken: string): Promise<TokensResponse> {
        const user = await this.usersRepo.findOne({ where: { user_id: userId } });
        if (!user) throw new UnauthorizedException(AUTH_MESSAGES.ERROR.INVALID_REFRESH_TOKEN);

        const matches = await bcrypt.compare(refreshToken, user.refresh_token);
        if (!matches) throw new UnauthorizedException(AUTH_MESSAGES.ERROR.INVALID_REFRESH_TOKEN);

        const tokens = await this.issueTokens(user.user_id, user.email);
        await this.saveRefreshToken(user.user_id, tokens.refresh_token);
        return tokens;
    }

    async logout(userId: string): Promise<LogoutResponse> {
        await this.usersRepo.update({ user_id: userId }, { refresh_token: null });
        return { success: true };
    }

    private async issueTokens(userId: string, email: string) {
        const payload: TokenPayload = { sub: userId, email };
        const accessToken = await this.jwt.signAsync(payload);

        // dùng config mặc định trong JwtModule cho access token
        const refreshToken = await this.jwt.signAsync(payload, {
            secret: process.env.JWT_REFRESH_SECRET as string,
            expiresIn: (process.env.JWT_REFRESH_EXPIRES ?? '7d') as StringValue,
        });

        return { access_token: accessToken, refresh_token: refreshToken };
    }

    private async saveRefreshToken(userId: string, refreshToken: string) {
        const hash = await bcrypt.hash(refreshToken, 10);
        await this.usersRepo.update({ user_id: userId }, { refresh_token: hash });
    }

    /**
     * Send OTP for payment verification
     */
    async sendOtpPayment(
        dto: SendOtpPaymentDto
    ): Promise<{ success: boolean; message: string; expiresIn: number }> {
        // Validate user exists
        const user = await this.usersRepo.findOne({ where: { user_id: dto.userId } });
        if (!user) {
            throw new NotFoundException(AUTH_MESSAGES.ERROR.USER_NOT_FOUND);
        }

        // Generate OTP
        const otp = this.otpStorageService.generateOtp();
        const expiresIn = 15 * 60; // 15 minutes

        // Store OTP in Redis
        await this.otpStorageService.storePaymentOtp(dto.userId, otp, expiresIn);

        // Send OTP email via Email Microservice
        try {
            await firstValueFrom(
                this.emailClient.send(EMAIL_MS.PATTERN.SEND_EMAIL, {
                    to: user.email,
                    template: EmailTemplate.OTP_PAYMENT,
                    templateData: {
                        otp,
                        expiresIn: `${Math.floor(expiresIn / 60)} minutes`,
                    },
                })
            );

            this.logger.log(`OTP sent for payment: userId=${dto.userId}`);
            return {
                success: true,
                message: AUTH_MESSAGES.SUCCESS.OTP_PAYMENT_SENT,
                expiresIn,
            };
        } catch (error: any) {
            this.logger.error(`Failed to send OTP email: ${error.message}`);
            // Delete OTP if email sending fails
            await this.otpStorageService.deleteOtp('payment', dto.userId);

            // Handle microservice connection errors - these are infrastructure issues (503)
            const errorMessage = error?.message || error?.toString() || '';
            const errorCode = error?.code || '';

            // Connection refused - microservice is not running
            if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
                throw new ServiceUnavailableException(
                    AUTH_MESSAGES.ERROR.EMAIL_SERVICE_UNAVAILABLE
                );
            }

            // Connection closed - microservice disconnected
            if (errorMessage.includes('Connection closed')) {
                throw new ServiceUnavailableException(
                    AUTH_MESSAGES.ERROR.EMAIL_SERVICE_CONNECTION_CLOSED
                );
            }

            // Timeout errors - microservice not responding
            if (
                errorCode === 'ETIMEDOUT' ||
                errorMessage.includes('timeout') ||
                errorMessage.includes('ETIMEDOUT')
            ) {
                throw new ServiceUnavailableException(AUTH_MESSAGES.ERROR.EMAIL_SERVICE_TIMEOUT);
            }

            // For other errors, throw BadRequestException
            throw new BadRequestException(AUTH_MESSAGES.ERROR.FAILED_TO_SEND_OTP_EMAIL);
        }
    }

    /**
     * Verify OTP for payment
     */
    async verifyOtpPayment(
        dto: VerifyOtpPaymentDto
    ): Promise<{ success: boolean; message: string }> {
        // Validate user exists
        const user = await this.usersRepo.findOne({ where: { user_id: dto.userId } });
        if (!user) {
            throw new NotFoundException(AUTH_MESSAGES.ERROR.USER_NOT_FOUND);
        }

        // Verify OTP
        const isValid = await this.otpStorageService.verifyPaymentOtp(dto.userId, dto.otp);
        if (!isValid) {
            throw new UnauthorizedException(AUTH_MESSAGES.ERROR.INVALID_OR_EXPIRED_OTP);
        }

        this.logger.log(`OTP verified for payment: userId=${dto.userId}`);
        return {
            success: true,
            message: AUTH_MESSAGES.SUCCESS.OTP_PAYMENT_VERIFIED,
        };
    }

    /**
     * Send OTP for password reset
     */
    async sendOtpPasswordReset(
        dto: SendOtpPasswordResetDto
    ): Promise<{ success: boolean; message: string; expiresIn: number }> {
        // Validate user exists
        const user = await this.usersRepo.findOne({ where: { email: dto.email } });
        if (!user) {
            // Don't reveal if user exists or not (security best practice)
            // Return success even if user doesn't exist to prevent email enumeration
            this.logger.warn(`Password reset requested for non-existent email: ${dto.email}`);
            return {
                success: true,
                message: AUTH_MESSAGES.SUCCESS.PASSWORD_RESET_OTP_SENT,
                expiresIn: 10 * 60, // Return same value regardless
            };
        }

        // Generate OTP
        const otp = this.otpStorageService.generateOtp();
        const expiresIn = 10 * 60; // 10 minutes

        // Store OTP in Redis
        await this.otpStorageService.storePasswordResetOtp(dto.email, otp, expiresIn);

        // Send OTP email via Email Microservice
        try {
            await firstValueFrom(
                this.emailClient.send(EMAIL_MS.PATTERN.SEND_EMAIL, {
                    to: user.email,
                    template: EmailTemplate.OTP_PASSWORD_RESET,
                    templateData: {
                        otp,
                        expiresIn: `${Math.floor(expiresIn / 60)} minutes`,
                    },
                })
            );

            this.logger.log(`OTP sent for password reset: email=${dto.email}`);
            return {
                success: true,
                message: AUTH_MESSAGES.SUCCESS.PASSWORD_RESET_OTP_SENT,
                expiresIn,
            };
        } catch (error: any) {
            this.logger.error(`Failed to send OTP email: ${error.message}`);
            // Delete OTP if email sending fails
            await this.otpStorageService.deleteOtp('password-reset', dto.email);

            // Handle microservice connection errors - these are infrastructure issues (503)
            const errorMessage = error?.message || error?.toString() || '';
            const errorCode = error?.code || '';

            // Connection refused - microservice is not running
            if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
                throw new ServiceUnavailableException(
                    AUTH_MESSAGES.ERROR.EMAIL_SERVICE_UNAVAILABLE
                );
            }

            // Connection closed - microservice disconnected
            if (errorMessage.includes('Connection closed')) {
                throw new ServiceUnavailableException(
                    AUTH_MESSAGES.ERROR.EMAIL_SERVICE_CONNECTION_CLOSED
                );
            }

            // Timeout errors - microservice not responding
            if (
                errorCode === 'ETIMEDOUT' ||
                errorMessage.includes('timeout') ||
                errorMessage.includes('ETIMEDOUT')
            ) {
                throw new ServiceUnavailableException(AUTH_MESSAGES.ERROR.EMAIL_SERVICE_TIMEOUT);
            }

            // For other errors, throw BadRequestException
            throw new BadRequestException(AUTH_MESSAGES.ERROR.FAILED_TO_SEND_OTP_EMAIL);
        }
    }

    /**
     * Verify OTP and reset password
     */
    async verifyOtpPasswordReset(
        dto: VerifyOtpPasswordResetDto
    ): Promise<{ success: boolean; message: string }> {
        // Validate user exists
        const user = await this.usersRepo.findOne({ where: { email: dto.email } });
        if (!user) {
            throw new NotFoundException(AUTH_MESSAGES.ERROR.USER_NOT_FOUND);
        }

        // Verify OTP
        const isValid = await this.otpStorageService.verifyPasswordResetOtp(dto.email, dto.otp);
        if (!isValid) {
            throw new UnauthorizedException(AUTH_MESSAGES.ERROR.INVALID_OR_EXPIRED_OTP);
        }

        // Reset password
        const passwordHash = await bcrypt.hash(dto.newPassword, 10);
        await this.usersRepo.update({ user_id: user.user_id }, { password_hash: passwordHash });

        this.logger.log(`Password reset successful: email=${dto.email}`);
        return {
            success: true,
            message: AUTH_MESSAGES.SUCCESS.PASSWORD_RESET,
        };
    }

    /**
     * Send OTP for cancellation verification
     */
    async sendOtpCancellation(
        dto: SendOtpCancellationDto
    ): Promise<{ success: boolean; message: string; expiresIn: number }> {
        // Validate user exists
        const user = await this.usersRepo.findOne({ where: { user_id: dto.userId } });
        if (!user) {
            throw new NotFoundException(AUTH_MESSAGES.ERROR.USER_NOT_FOUND);
        }

        // Generate OTP
        const otp = this.otpStorageService.generateOtp();
        const expiresIn = 15 * 60; // 15 minutes

        // Store OTP in Redis
        await this.otpStorageService.storeCancellationOtp(
            dto.userId,
            dto.bookingId,
            otp,
            expiresIn
        );

        // Send OTP email via Email Microservice
        try {
            await firstValueFrom(
                this.emailClient.send(EMAIL_MS.PATTERN.SEND_EMAIL, {
                    to: user.email,
                    template: EmailTemplate.OTP_CANCELLATION,
                    templateData: {
                        otp,
                        expiresIn: `${Math.floor(expiresIn / 60)} minutes`,
                    },
                })
            );

            this.logger.log(
                `OTP sent for cancellation: userId=${dto.userId}, bookingId=${dto.bookingId}`
            );
            return {
                success: true,
                message: AUTH_MESSAGES.SUCCESS.OTP_CANCELLATION_SENT,
                expiresIn,
            };
        } catch (error: any) {
            this.logger.error(`Failed to send OTP email: ${error.message}`);
            // Delete OTP if email sending fails
            await this.otpStorageService.deleteOtp(
                'cancellation',
                `${dto.userId}:${dto.bookingId}`
            );

            // Handle microservice connection errors - these are infrastructure issues (503)
            const errorMessage = error?.message || error?.toString() || '';
            const errorCode = error?.code || '';

            // Connection refused - microservice is not running
            if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
                throw new ServiceUnavailableException(
                    AUTH_MESSAGES.ERROR.EMAIL_SERVICE_UNAVAILABLE
                );
            }

            // Connection closed - microservice disconnected
            if (errorMessage.includes('Connection closed')) {
                throw new ServiceUnavailableException(
                    AUTH_MESSAGES.ERROR.EMAIL_SERVICE_CONNECTION_CLOSED
                );
            }

            // Timeout errors - microservice not responding
            if (
                errorCode === 'ETIMEDOUT' ||
                errorMessage.includes('timeout') ||
                errorMessage.includes('ETIMEDOUT')
            ) {
                throw new ServiceUnavailableException(AUTH_MESSAGES.ERROR.EMAIL_SERVICE_TIMEOUT);
            }

            // For other errors, throw BadRequestException
            throw new BadRequestException(AUTH_MESSAGES.ERROR.FAILED_TO_SEND_OTP_EMAIL);
        }
    }

    /**
     * Verify OTP for cancellation
     */
    async verifyOtpCancellation(
        dto: VerifyOtpCancellationDto
    ): Promise<{ success: boolean; message: string }> {
        // Validate user exists
        const user = await this.usersRepo.findOne({ where: { user_id: dto.userId } });
        if (!user) {
            throw new NotFoundException(AUTH_MESSAGES.ERROR.USER_NOT_FOUND);
        }

        // Verify OTP
        const isValid = await this.otpStorageService.verifyCancellationOtp(
            dto.userId,
            dto.bookingId,
            dto.otp
        );
        if (!isValid) {
            throw new UnauthorizedException(AUTH_MESSAGES.ERROR.INVALID_OR_EXPIRED_OTP);
        }

        this.logger.log(
            `OTP verified for cancellation: userId=${dto.userId}, bookingId=${dto.bookingId}`
        );
        return {
            success: true,
            message: AUTH_MESSAGES.SUCCESS.OTP_CANCELLATION_VERIFIED,
        };
    }

    /**
     * Check if cancellation OTP has been verified
     */
    async isCancellationOtpVerified(userId: string, bookingId: string): Promise<boolean> {
        return await this.otpStorageService.isCancellationOtpVerified(userId, bookingId);
    }

    /**
     * Delete cancellation verification token (after successful cancellation)
     */
    async deleteCancellationVerificationToken(userId: string, bookingId: string): Promise<void> {
        await this.otpStorageService.deleteCancellationVerificationToken(userId, bookingId);
    }

    /**
     * Get user with roles
     */
    async getUserWithRoles(userId: string): Promise<{
        userId: string;
        email: string;
        fullname: string;
        phone: string | null;
        roles: Array<{ roleCode: string; name: string; description: string | null }>;
    }> {
        const user = await this.usersRepo.findOne({
            where: { user_id: userId },
            relations: ['userRoles', 'userRoles.role'],
        });

        if (!user) {
            throw new NotFoundException(AUTH_MESSAGES.ERROR.USER_NOT_FOUND);
        }

        const roles =
            user.userRoles?.map((ur) => ({
                roleCode: ur.role.role_code,
                name: ur.role.name,
                description: ur.role.description,
            })) || [];

        return {
            userId: user.user_id,
            email: user.email,
            fullname: user.fullname,
            phone: user.phone,
            roles,
        };
    }
}
