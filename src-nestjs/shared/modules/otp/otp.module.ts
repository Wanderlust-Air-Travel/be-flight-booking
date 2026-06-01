import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { OtpStorageService } from '../../services/otp-storage.service';

/**
 * OTP Module
 * Provides OTP storage and verification service using Redis
 */
@Module({
	imports: [RedisModule],
	providers: [OtpStorageService],
	exports: [OtpStorageService],
})
export class OtpModule {}

