import { ConflictException, Injectable, UnauthorizedException, NotFoundException, BadRequestException, Inject, Logger, ServiceUnavailableException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "src/shared/entities/user/user.entity";
import { Repository } from "typeorm";
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { SendOtpPaymentDto } from "./dto/send-otp-payment.dto";
import { VerifyOtpPaymentDto } from "./dto/verify-otp-payment.dto";
import { SendOtpPasswordResetDto } from "./dto/send-otp-password-reset.dto";
import { VerifyOtpPasswordResetDto } from "./dto/verify-otp-password-reset.dto";
import * as bcrypt from 'bcrypt';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - uuid package is ESM but works fine with CommonJS
import { v7 as uuidv7 } from 'uuid';
import { TokenPayload } from "src/shared/types/auth/token-payload";
import type { StringValue } from 'ms';
import { CreateUserResponse } from "src/shared/types/auth/create-user-response";
import { LoginResponse } from "src/shared/types/auth/login-response";
import { TokensResponse } from "src/shared/types/auth/tokens-response";
import { LogoutResponse } from "src/shared/types/auth/logout-response";
import { OtpStorageService } from "src/shared/services/otp-storage.service";
import { EMAIL_MS } from "src/microservices/email/email.messages";
import { EmailTemplate } from "src/shared/constants/enums";

@Injectable()
export class AuthService {
	private readonly logger = new Logger(AuthService.name);

    constructor(
        @InjectRepository(User)
        private readonly usersRepo: Repository<User>,
        private readonly jwt: JwtService,
		@Inject('EMAIL_CLIENT') private readonly emailClient: ClientProxy,
		private readonly otpStorageService: OtpStorageService,
    ) {}

    async register(data: RegisterDto): Promise<CreateUserResponse> {
        const existed = await this.usersRepo.findOne({ where: { email: data.email } });
        if (existed) {
            throw new ConflictException('Email already registered');
        }

        const password_hash = await bcrypt.hash(data.password, 10);
        const user = this.usersRepo.create({
            user_id: uuidv7(), // Generate UUID v7 for user_id
            fullname: data.fullname,
            password_hash,
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
                phone: user.phone
            },
            ...tokens
        };
    }

    async login(data: LoginDto): Promise<LoginResponse> {
        const user = await this.usersRepo.findOne( { where: { email: data.email }});
        if (!user) throw new UnauthorizedException('Invalid credentials');

        const ok = await bcrypt.compare(data.password, user.password_hash);
        if (!ok) throw new UnauthorizedException('Invalid credentials');

        const tokens = await this.issueTokens(user.user_id, user.email);
        await this.saveRefreshToken(user.user_id, tokens.refresh_token);

        return {
            user: {
                id: user.user_id,
                email: user.email,
                fullname: user.fullname,
                phone: user.phone
            },
            ... tokens
        };
    }

    async refresh(userId: string, refresh_token: string): Promise<TokensResponse> {
        const user = await this.usersRepo.findOne({ where: { user_id: userId } });
        if (!user) throw new UnauthorizedException();

        const matches = await bcrypt.compare(refresh_token, user.refresh_token);
        if (!matches) throw new UnauthorizedException();

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
        const access_token = await this.jwt.signAsync(payload);

         // dùng config mặc định trong JwtModule cho access token
        const refresh_token = await this.jwt.signAsync(payload, {
            secret: process.env.JWT_REFRESH_SECRET as string,
            expiresIn: (process.env.JWT_REFRESH_EXPIRES ?? '7d') as StringValue,
        });

        return { access_token, refresh_token };
    }

    private async saveRefreshToken(userId: string, refreshToken: string) {
        const hash = await bcrypt.hash(refreshToken, 10);
        await this.usersRepo.update({ user_id: userId }, { refresh_token: hash })
    }

	/**
	 * Send OTP for payment verification
	 */
	async sendOtpPayment(dto: SendOtpPaymentDto): Promise<{ success: boolean; message: string; expiresIn: number }> {
		// Validate user exists
		const user = await this.usersRepo.findOne({ where: { user_id: dto.userId } });
		if (!user) {
			throw new NotFoundException(`User ${dto.userId} not found`);
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
				}),
			);

			this.logger.log(`OTP sent for payment: userId=${dto.userId}`);
			return {
				success: true,
				message: 'OTP sent successfully',
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
				throw new ServiceUnavailableException('Email microservice is not available. Please ensure the service is running.');
			}
			
			// Connection closed - microservice disconnected
			if (errorMessage.includes('Connection closed')) {
				throw new ServiceUnavailableException('Email microservice connection was closed. Please ensure the service is running.');
			}
			
			// Timeout errors - microservice not responding
			if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
				throw new ServiceUnavailableException('Email microservice request timeout. The service may be unavailable or overloaded.');
			}
			
			// For other errors, throw BadRequestException
			throw new BadRequestException('Failed to send OTP email. Please try again.');
		}
	}

	/**
	 * Verify OTP for payment
	 */
	async verifyOtpPayment(dto: VerifyOtpPaymentDto): Promise<{ success: boolean; message: string }> {
		// Validate user exists
		const user = await this.usersRepo.findOne({ where: { user_id: dto.userId } });
		if (!user) {
			throw new NotFoundException(`User ${dto.userId} not found`);
		}

		// Verify OTP
		const isValid = await this.otpStorageService.verifyPaymentOtp(dto.userId, dto.otp);
		if (!isValid) {
			throw new UnauthorizedException('Invalid or expired OTP');
		}

		this.logger.log(`OTP verified for payment: userId=${dto.userId}`);
		return {
			success: true,
			message: 'OTP verified successfully',
		};
	}

	/**
	 * Send OTP for password reset
	 */
	async sendOtpPasswordReset(dto: SendOtpPasswordResetDto): Promise<{ success: boolean; message: string; expiresIn: number }> {
		// Validate user exists
		const user = await this.usersRepo.findOne({ where: { email: dto.email } });
		if (!user) {
			// Don't reveal if user exists or not (security best practice)
			// Return success even if user doesn't exist to prevent email enumeration
			this.logger.warn(`Password reset requested for non-existent email: ${dto.email}`);
			return {
				success: true,
				message: 'If the email exists, an OTP has been sent',
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
				}),
			);

			this.logger.log(`OTP sent for password reset: email=${dto.email}`);
			return {
				success: true,
				message: 'If the email exists, an OTP has been sent',
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
				throw new ServiceUnavailableException('Email microservice is not available. Please ensure the service is running.');
			}
			
			// Connection closed - microservice disconnected
			if (errorMessage.includes('Connection closed')) {
				throw new ServiceUnavailableException('Email microservice connection was closed. Please ensure the service is running.');
			}
			
			// Timeout errors - microservice not responding
			if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
				throw new ServiceUnavailableException('Email microservice request timeout. The service may be unavailable or overloaded.');
			}
			
			// For other errors, throw BadRequestException
			throw new BadRequestException('Failed to send OTP email. Please try again.');
		}
	}

	/**
	 * Verify OTP and reset password
	 */
	async verifyOtpPasswordReset(dto: VerifyOtpPasswordResetDto): Promise<{ success: boolean; message: string }> {
		// Validate user exists
		const user = await this.usersRepo.findOne({ where: { email: dto.email } });
		if (!user) {
			throw new NotFoundException(`User with email ${dto.email} not found`);
		}

		// Verify OTP
		const isValid = await this.otpStorageService.verifyPasswordResetOtp(dto.email, dto.otp);
		if (!isValid) {
			throw new UnauthorizedException('Invalid or expired OTP');
		}

		// Reset password
		const passwordHash = await bcrypt.hash(dto.newPassword, 10);
		await this.usersRepo.update({ user_id: user.user_id }, { password_hash: passwordHash });

		this.logger.log(`Password reset successful: email=${dto.email}`);
		return {
			success: true,
			message: 'Password reset successfully',
		};
	}
}