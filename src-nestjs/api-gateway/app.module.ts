import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import appConfig from 'src/shared/config/app.config';
import { DataProvidersModule } from 'src/shared/modules/data-providers/data-providers.module';
import { AuthModule } from './modules/auth/auth.module';
import { SearchClientModule } from './modules/search/search.client.module';
import { ServicesClientModule } from './modules/services/services.client.module';
import { RoutesClientModule } from './modules/routes/routes.client.module';
import { BookingClientModule } from './modules/booking/booking.client.module';
import { ReservationClientModule } from './modules/reservation/reservation.client.module';
import { PaymentClientModule } from './modules/payment/payment.client.module';
import { PaymentModule } from './modules/payment/payment.module';
import { EmailClientModule } from './modules/email/email.client.module';
import { HealthModule } from './modules/health/health.module';
import { BookingStateModule } from './modules/booking-state/booking-state.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { AdminModule } from './modules/admin/admin.module';
import { CommonModule } from 'src/shared/modules/common/common.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }), // load .env and app config
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10) * 1000, // Convert to milliseconds
        limit: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
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
      entities: [__dirname + '/../shared/entities/**/*.entity.{ts,js}'],
    }),
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
