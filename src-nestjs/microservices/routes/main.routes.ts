import { resolve } from 'node:path';
import { config } from 'dotenv';

config({ path: resolve(process.cwd(), '.env') });

import { ValidationPipe } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { type MicroserviceOptions, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ROUTES_MS } from './routes.messages';
import { RoutesModule } from './routes.module';

@Module({
    imports: [
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
        RoutesModule,
    ],
})
class RoutesBootstrapModule {}

async function bootstrap() {
    const app = await NestFactory.createMicroservice<MicroserviceOptions>(RoutesBootstrapModule, {
        transport: Transport.TCP,
        options: {
            host: ROUTES_MS.TCP_HOST,
            port: ROUTES_MS.TCP_PORT,
        },
    });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen();
    console.log(`Routes microservice is listening on ${ROUTES_MS.TCP_HOST}:${ROUTES_MS.TCP_PORT}`);
}
bootstrap().catch((error) => {
    console.error('Failed to start Routes microservice:', error);
    process.exit(1);
});
