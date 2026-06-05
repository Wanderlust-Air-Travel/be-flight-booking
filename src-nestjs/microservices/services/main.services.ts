import { resolve } from 'node:path';
import { config } from 'dotenv';

// Load .env file from project root (works with ts-node)
config({ path: resolve(process.cwd(), '.env') });

import { ValidationPipe } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { type MicroserviceOptions, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SERVICES_MS } from './services.messages';
import { ServicesModule } from './services.module';

@Module({
    imports: [
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
            entities: [`${__dirname}/../../shared/entities/**/*.entity.{ts,js}`],
        }),
        ServicesModule,
    ],
})
class ServicesBootstrapModule {}

async function bootstrap() {
    const app = await NestFactory.createMicroservice<MicroserviceOptions>(ServicesBootstrapModule, {
        transport: Transport.TCP,
        options: {
            host: SERVICES_MS.TCP_HOST,
            port: SERVICES_MS.TCP_PORT,
        },
    });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen();
    console.log(
        `Services microservice is listening on ${SERVICES_MS.TCP_HOST}:${SERVICES_MS.TCP_PORT}`
    );
}
bootstrap().catch((error) => {
    console.error('Failed to start Services microservice:', error);
    process.exit(1);
});
