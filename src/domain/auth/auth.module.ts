import { Module } from "@nestjs/common";
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from "./strategies/jwt.strategyt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../user/entity/user.entity";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import type { StringValue } from 'ms';

@Module({
    imports: [
        TypeOrmModule.forFeature([User]),
        JwtModule.register({
            secret: process.env.JWT_ACCESS_SECRET,
            signOptions: {
                expiresIn: (process.env.JWT_ACCESS_EXPIRES ?? '15m') as StringValue,
            }
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy]
})
export class AuthModule {};