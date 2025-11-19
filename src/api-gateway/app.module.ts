import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { SearchClientModule } from './modules/search/search.client.module';
import { ServicesClientModule } from './modules/services/services.client.module';
import { RoutesClientModule } from './modules/routes/routes.client.module';
import { BookingClientModule } from './modules/booking/booking.client.module';
import { ReservationClientModule } from './modules/reservation/reservation.client.module';
import { PaymentClientModule } from './modules/payment/payment.client.module';
import { PaymentModule } from './modules/payment/payment.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // load .env
    TypeOrmModule.forRoot({
      type: 'mssql',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 1433),
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUE_CERT === 'true',
       },
      synchronize: false,
      entities: [__dirname + '/../shared/entities/**/*.entity.{ts,js}'],
    }),
    AuthModule,
    SearchClientModule,
    ServicesClientModule,
    RoutesClientModule,
    BookingClientModule,
    ReservationClientModule,
    PaymentClientModule,
    PaymentModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
