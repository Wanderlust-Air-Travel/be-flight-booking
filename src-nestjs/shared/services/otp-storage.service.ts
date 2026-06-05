import { Injectable, Logger } from '@nestjs/common';
import type { RedisService } from '../modules/redis/redis.service';

/**
 * OTP Storage Service
 * Handles OTP generation, storage, and verification using Redis
 */
@Injectable()
export class OtpStorageService {
    private readonly logger = new Logger(OtpStorageService.name);
    private readonly OTP_EXPIRY_SECONDS = {
        PAYMENT: 15 * 60, // 15 minutes
        PASSWORD_RESET: 10 * 60, // 10 minutes
        CANCELLATION: 15 * 60, // 15 minutes
    };

    constructor(private readonly redisService: RedisService) {}

    /**
     * Generate a 6-digit OTP code
     */
    generateOtp(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    /**
     * Store OTP for payment verification
     * @param userId User ID
     * @param otp OTP code
     * @param expiresIn Optional expiry time in seconds (default: 15 minutes)
     * @returns Promise resolving when OTP is stored
     */
    async storePaymentOtp(
        userId: string,
        otp: string,
        expiresIn: number = this.OTP_EXPIRY_SECONDS.PAYMENT
    ): Promise<void> {
        const key = `otp:payment:${userId}`;
        try {
            await this.redisService.set(key, otp, expiresIn);
            this.logger.log(`OTP stored for payment: userId=${userId}, expiresIn=${expiresIn}s`);
        } catch (error: any) {
            this.logger.error(`Failed to store payment OTP: ${error.message}`);
            throw error;
        }
    }

    /**
     * Verify OTP for payment
     * @param userId User ID
     * @param otp OTP code to verify
     * @returns true if OTP is valid, false otherwise
     */
    async verifyPaymentOtp(userId: string, otp: string): Promise<boolean> {
        const key = `otp:payment:${userId}`;
        try {
            const storedOtp = await this.redisService.get<string>(key);
            if (!storedOtp) {
                this.logger.warn(`No OTP found for payment: userId=${userId}`);
                return false;
            }

            // OTP is stored as JSON string, so we need to parse it
            const parsedOtp = typeof storedOtp === 'string' ? storedOtp : String(storedOtp);
            const isValid = parsedOtp === otp;
            if (isValid) {
                // Delete OTP after successful verification (one-time use)
                await this.redisService.del(key);
                this.logger.log(`OTP verified successfully for payment: userId=${userId}`);
            } else {
                this.logger.warn(`Invalid OTP for payment: userId=${userId}`);
            }
            return isValid;
        } catch (error: any) {
            this.logger.error(`Failed to verify payment OTP: ${error.message}`);
            return false;
        }
    }

    /**
     * Store OTP for password reset
     * @param email User email
     * @param otp OTP code
     * @param expiresIn Optional expiry time in seconds (default: 10 minutes)
     * @returns Promise resolving when OTP is stored
     */
    async storePasswordResetOtp(
        email: string,
        otp: string,
        expiresIn: number = this.OTP_EXPIRY_SECONDS.PASSWORD_RESET
    ): Promise<void> {
        const key = `otp:password-reset:${email}`;
        try {
            await this.redisService.set(key, otp, expiresIn);
            this.logger.log(
                `OTP stored for password reset: email=${email}, expiresIn=${expiresIn}s`
            );
        } catch (error: any) {
            this.logger.error(`Failed to store password reset OTP: ${error.message}`);
            throw error;
        }
    }

    /**
     * Verify OTP for password reset
     * @param email User email
     * @param otp OTP code to verify
     * @returns true if OTP is valid, false otherwise
     */
    async verifyPasswordResetOtp(email: string, otp: string): Promise<boolean> {
        const key = `otp:password-reset:${email}`;
        try {
            const storedOtp = await this.redisService.get<string>(key);
            if (!storedOtp) {
                this.logger.warn(`No OTP found for password reset: email=${email}`);
                return false;
            }

            // OTP is stored as JSON string, so we need to parse it
            const parsedOtp = typeof storedOtp === 'string' ? storedOtp : String(storedOtp);
            const isValid = parsedOtp === otp;
            if (isValid) {
                // Delete OTP after successful verification (one-time use)
                await this.redisService.del(key);
                this.logger.log(`OTP verified successfully for password reset: email=${email}`);
            } else {
                this.logger.warn(`Invalid OTP for password reset: email=${email}`);
            }
            return isValid;
        } catch (error: any) {
            this.logger.error(`Failed to verify password reset OTP: ${error.message}`);
            return false;
        }
    }

    /**
     * Store OTP for cancellation verification
     * @param userId User ID
     * @param bookingId Booking ID
     * @param otp OTP code
     * @param expiresIn Optional expiry time in seconds (default: 15 minutes)
     * @returns Promise resolving when OTP is stored
     */
    async storeCancellationOtp(
        userId: string,
        bookingId: string,
        otp: string,
        expiresIn: number = this.OTP_EXPIRY_SECONDS.CANCELLATION
    ): Promise<void> {
        const key = `otp:cancellation:${userId}:${bookingId}`;
        try {
            await this.redisService.set(key, otp, expiresIn);
            this.logger.log(
                `OTP stored for cancellation: userId=${userId}, bookingId=${bookingId}, expiresIn=${expiresIn}s`
            );
        } catch (error: any) {
            this.logger.error(`Failed to store cancellation OTP: ${error.message}`);
            throw error;
        }
    }

    /**
     * Verify OTP for cancellation
     * @param userId User ID
     * @param bookingId Booking ID
     * @param otp OTP code to verify
     * @returns true if OTP is valid, false otherwise
     */
    async verifyCancellationOtp(userId: string, bookingId: string, otp: string): Promise<boolean> {
        const key = `otp:cancellation:${userId}:${bookingId}`;
        try {
            const storedOtp = await this.redisService.get<string>(key);
            if (!storedOtp) {
                this.logger.warn(
                    `No OTP found for cancellation: userId=${userId}, bookingId=${bookingId}`
                );
                return false;
            }

            // OTP is stored as JSON string, so we need to parse it
            const parsedOtp = typeof storedOtp === 'string' ? storedOtp : String(storedOtp);
            const isValid = parsedOtp === otp;
            if (isValid) {
                // Delete OTP after successful verification (one-time use)
                await this.redisService.del(key);

                // Store verification token (valid for 10 minutes) to allow cancellation
                const verificationTokenKey = `otp:cancellation:verified:${userId}:${bookingId}`;
                await this.redisService.set(verificationTokenKey, 'verified', 10 * 60); // 10 minutes

                this.logger.log(
                    `OTP verified successfully for cancellation: userId=${userId}, bookingId=${bookingId}`
                );
            } else {
                this.logger.warn(
                    `Invalid OTP for cancellation: userId=${userId}, bookingId=${bookingId}`
                );
            }
            return isValid;
        } catch (error: any) {
            this.logger.error(`Failed to verify cancellation OTP: ${error.message}`);
            return false;
        }
    }

    /**
     * Check if cancellation OTP has been verified for a booking
     * @param userId User ID
     * @param bookingId Booking ID
     * @returns true if OTP was verified, false otherwise
     */
    async isCancellationOtpVerified(userId: string, bookingId: string): Promise<boolean> {
        const verificationTokenKey = `otp:cancellation:verified:${userId}:${bookingId}`;
        try {
            const verified = await this.redisService.get<string>(verificationTokenKey);
            return verified === 'verified';
        } catch (error: any) {
            this.logger.error(`Failed to check cancellation OTP verification: ${error.message}`);
            return false;
        }
    }

    /**
     * Delete cancellation verification token (after successful cancellation)
     * @param userId User ID
     * @param bookingId Booking ID
     */
    async deleteCancellationVerificationToken(userId: string, bookingId: string): Promise<void> {
        const verificationTokenKey = `otp:cancellation:verified:${userId}:${bookingId}`;
        try {
            await this.redisService.del(verificationTokenKey);
            this.logger.log(
                `Cancellation verification token deleted: userId=${userId}, bookingId=${bookingId}`
            );
        } catch (error: any) {
            this.logger.error(`Failed to delete cancellation verification token: ${error.message}`);
            // Don't throw - deletion is best effort
        }
    }

    /**
     * Delete OTP (useful for cleanup or manual invalidation)
     * @param type OTP type: 'payment', 'password-reset', or 'cancellation'
     * @param identifier User ID or email (for cancellation, use format 'userId:bookingId')
     */
    async deleteOtp(
        type: 'payment' | 'password-reset' | 'cancellation',
        identifier: string
    ): Promise<void> {
        const key = `otp:${type}:${identifier}`;
        try {
            await this.redisService.del(key);
            this.logger.log(`OTP deleted: type=${type}, identifier=${identifier}`);
        } catch (error: any) {
            this.logger.error(`Failed to delete OTP: ${error.message}`);
            // Don't throw - deletion is best effort
        }
    }
}
