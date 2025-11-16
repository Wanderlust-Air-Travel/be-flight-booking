import { Module } from "@nestjs/common";
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../user/entity/user.entity";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import type { StringValue } from 'ms';
import { JwtStrategy } from "./strategies/jwt.strategyt";
import { ConfigModule, ConfigService } from "@nestjs/config";

@Module({
    imports: [
        ConfigModule,
        TypeOrmModule.forFeature([User]),
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
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy]
})
export class AuthModule {};