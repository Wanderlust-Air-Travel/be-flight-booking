import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Airport } from 'src/api-gateway/data-access/entities/airport/airport.entity';
import appConfig from 'src/shared/config/app.config';
import { CommonModule } from 'src/shared/modules/common/common.module';
import { DataProvidersModule } from 'src/shared/modules/data-providers/data-providers.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookingStateModule } from './modules/booking-state/booking-state.module';
import { BookingClientModule } from './modules/booking/booking.client.module';
import { DevModule } from './modules/dev/dev.module';
import { EmailClientModule } from './modules/email/email.client.module';
import { HealthModule } from './modules/health/health.module';
import { PaymentClientModule } from './modules/payment/payment.client.module';
import { PaymentModule } from './modules/payment/payment.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { ReservationClientModule } from './modules/reservation/reservation.client.module';
import { RoutesClientModule } from './modules/routes/routes.client.module';
import { SearchClientModule } from './modules/search/search.client.module';
import { ServicesClientModule } from './modules/services/services.client.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [appConfig],
        }), // load .env and app config
        ThrottlerModule.forRoot([
            {
                ttl: Number.parseInt(process.env.RATE_LIMIT_TTL || '60', 10) * 1000, // Convert to milliseconds
                limit: Number.parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
            },
        ]),
        TypeOrmModule.forRoot({
            type: 'mssql',
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT ?? 1434),
            username: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
            options: {
                encrypt: process.env.DB_ENCRYPT === 'true',
                trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
            },
            synchronize: false,
            entities: [`${__dirname}/../data-access/entities/**/*.entity.{ts,js}`],
        }),
        TypeOrmModule.forFeature([Airport]),
        DataProvidersModule,
        AuthModule,
        SearchClientModule,
        ServicesClientModule,
        RoutesClientModule,
        BookingClientModule,
        ReservationClientModule,
        PaymentClientModule,
        PaymentModule,
        EmailClientModule,
        HealthModule,
        BookingStateModule,
        RealtimeModule,
        AdminModule,
        CommonModule,
        DevModule,
    ],
    controllers: [],
    providers: [
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
    ],
})
export class AppModule {}
