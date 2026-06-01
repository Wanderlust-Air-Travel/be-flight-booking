import { Module } from "@nestjs/common";
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "src/shared/entities/user/user.entity";
import { Role } from "src/shared/entities/role/role.entity";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import type { StringValue } from 'ms';
import { JwtStrategy } from "./strategies/jwt.strategyt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EmailClientModule } from "../email/email.client.module";
import { OtpModule } from "src/shared/modules/otp/otp.module";
import { OptionalJwtAuthGuard } from "./guard/optional-jwt-auth.guard";

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
                }
            })
        }),
        EmailClientModule, // Add Email Client module for sending OTP emails
        OtpModule, // Add OTP module for OTP storage and verification
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy, OptionalJwtAuthGuard],
    exports: [OptionalJwtAuthGuard, PassportModule, AuthService, JwtModule], // Export JwtModule for use in other modules (e.g., RealtimeModule)
})
export class AuthModule {};