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
import { PAYMENT_MS } from './payment.messages';
import { PaymentModule } from './payment.module';

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
        PaymentModule,
    ],
})
class PaymentBootstrapModule {}

async function bootstrap() {
    const app = await NestFactory.createMicroservice<MicroserviceOptions>(PaymentBootstrapModule, {
        transport: Transport.TCP,
        options: {
            host: PAYMENT_MS.TCP_HOST,
            port: PAYMENT_MS.TCP_PORT,
        },
    });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen();
    console.log(
        `Payment microservice is listening on ${PAYMENT_MS.TCP_HOST}:${PAYMENT_MS.TCP_PORT}`
    );
}
bootstrap().catch((error) => {
    console.error('Failed to start Payment microservice:', error);
    process.exit(1);
});
