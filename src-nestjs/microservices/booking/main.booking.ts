import { resolve } from 'node:path';
import { config } from 'dotenv';

// Load .env file from project root (works with ts-node)
config({ path: resolve(process.cwd(), '.env') });

import { ValidationPipe } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { type MicroserviceOptions, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BOOKING_MS } from './booking.messages';
import { BookingModule } from './booking.module';
import { BookingRpcExceptionFilter } from './filters/booking-rpc-exception.filter';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        // Reuse the same global TypeORM configuration via AppModule pattern:
        TypeOrmModule.forRoot({
            type: 'mssql',
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT),
            username: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
            options: {
                encrypt: process.env.DB_ENCRYPT === 'true',
                trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
            },
            synchronize: false,
            entities: [
                `${__dirname}/../../api-gateway/data-access/entities/**/*.entity.{ts,js}`,
                `${__dirname}/../../shared/infrastructure/persistence/typeorm/entities/*.entity.{ts,js}`,
            ],
        }),
        BookingModule,
    ],
})
class BookingBootstrapModule {}

async function bootstrap() {
    const app = await NestFactory.createMicroservice<MicroserviceOptions>(BookingBootstrapModule, {
        transport: Transport.TCP,
        options: {
            host: BOOKING_MS.TCP_HOST,
            port: BOOKING_MS.TCP_PORT,
        },
    });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new BookingRpcExceptionFilter());
    await app.listen();
    console.log(
        `Booking microservice is listening on ${BOOKING_MS.TCP_HOST}:${BOOKING_MS.TCP_PORT}`
    );
}
bootstrap().catch((error) => {
    console.error('Failed to start Booking microservice:', error);
    process.exit(1);
});
