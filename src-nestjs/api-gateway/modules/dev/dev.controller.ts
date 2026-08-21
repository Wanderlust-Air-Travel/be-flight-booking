import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Post,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoginResponse } from 'src/shared/types/auth/login-response';
import { DevService } from './dev.service';
import { DevAccountDto } from './dto/dev-account.dto';
import type { DevLoginDto } from './dto/dev-login.dto';

@ApiTags('dev')
@Controller('dev')
export class DevController {
    constructor(private readonly devService: DevService) {}

    /**
     * Hard-gate both endpoints so they cannot be reached in production
     * and cannot be enabled by accident in other environments.
     */
    private ensureDevMode(): void {
        if (process.env.NODE_ENV === 'production') {
            throw new NotFoundException();
        }
        if (process.env.DEV_LOGIN_ENABLED !== 'true') {
            throw new NotFoundException();
        }
    }

    @Get('accounts')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'List dev-only test accounts',
        description:
            'Returns one active user per dev-facing role. Hard-gated: only available when NODE_ENV !== "production" AND DEV_LOGIN_ENABLED === "true".',
    })
    @ApiOkResponse({
        description: 'Dev accounts retrieved successfully',
        type: () => DevAccountDto,
        isArray: true,
    })
    async listAccounts(): Promise<DevAccountDto[]> {
        this.ensureDevMode();
        return this.devService.listAccounts();
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Login without a password (dev only)',
        description:
            'Issues a real JWT session for the given email without verifying the password. Hard-gated: only available when NODE_ENV !== "production" AND DEV_LOGIN_ENABLED === "true".',
    })
    @ApiOkResponse({
        description: 'Login successful',
        type: () => LoginResponse,
    })
    async login(@Body() dto: DevLoginDto): Promise<LoginResponse> {
        this.ensureDevMode();
        return this.devService.loginByEmail(dto.email);
    }
}
