import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { StringValue } from 'ms';
import { AuthTokenService } from 'src/api-gateway/common/services/auth-token.service';
import { Role } from 'src/api-gateway/data-access/entities/role/role.entity';
import { User } from 'src/api-gateway/data-access/entities/user/user.entity';
import { OtpModule } from 'src/shared/modules/otp/otp.module';
import { EmailClientModule } from '../email/email.client.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OptionalJwtAuthGuard } from './guard/optional-jwt-auth.guard';
import { JwtStrategy } from './strategies/jwt.strategyt';

@Module({
    imports: [
        ConfigModule,
        PassportModule.register({ defaultStrategy: 'jwt' }),
        TypeOrmModule.forFeature([User, Role]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (cfg: ConfigService) => ({
                secret: cfg.get<string>('JWT_ACCESS_SECRET', ''),
                signOptions: {
                    expiresIn: (process.env.JWT_ACCESS_EXPIRES ?? '15m') as StringValue,
                },
            }),
        }),
        EmailClientModule, // Add Email Client module for sending OTP emails
        OtpModule, // Add OTP module for OTP storage and verification
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy, OptionalJwtAuthGuard, AuthTokenService],
    exports: [
        OptionalJwtAuthGuard,
        PassportModule,
        AuthService,
        JwtModule,
        AuthTokenService, // Exported so DevModule can reuse token issuance
    ],
})
export class AuthModule {}
