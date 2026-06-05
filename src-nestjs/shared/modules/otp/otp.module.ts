import { Module } from '@nestjs/common';
import { OtpStorageService } from '../../services/otp-storage.service';
import { RedisModule } from '../redis/redis.module';

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
