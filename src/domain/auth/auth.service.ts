import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "../user/entity/user.entity";
import { Repository } from "typeorm";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import * as bcrypt from 'bcrypt';
import { TokenPayload } from "./types/token-payload";
import type { StringValue } from 'ms';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private readonly usersRepo: Repository<User>,
        private readonly jwt: JwtService,
    ) {}

    async register(data: RegisterDto) {
        const existed = await this.usersRepo.findOne({ where: { email: data.email } });
        if (existed) {
            throw new ConflictException('Email already registered');
        }

        const password_hash = await bcrypt.hash(data.password, 10);
        const user = this.usersRepo.create({
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

    async login(data: LoginDto) {
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

    async refresh(userId: string, refresh_token: string) {
        const user = await this.usersRepo.findOne({ where: { user_id: userId } });
        if (!user) throw new UnauthorizedException();

        const matches = await bcrypt.compare(refresh_token, user.refresh_token);
        if (!matches) throw new UnauthorizedException();

        const tokens = await this.issueTokens(user.user_id, user.email);
        await this.saveRefreshToken(user.user_id, tokens.refresh_token);
        return tokens;
    }

    async logout(userId: string) {
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
}