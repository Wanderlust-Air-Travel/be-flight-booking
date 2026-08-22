import { resolve } from 'node:path';
import { config } from 'dotenv';

// Load .env file from project root (works with ts-node)
config({ path: resolve(process.cwd(), '.env') });

import { Logger, ValidationPipe } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { type MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DataSource } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EMAIL_MS } from './email.messages';
import { EmailModule } from './email.module';
import { EmailMessageTypeOrmRepository } from './infrastructure/repositories/email-message.typeorm.repository';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
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
        EmailModule,
    ],
})
class EmailBootstrapModule {}

async function bootstrap() {
    const logger = new Logger('EmailBootstrap');
    logger.log('Starting Email microservice...');
    logger.log(`TCP Host: ${EMAIL_MS.TCP_HOST}, Port: ${EMAIL_MS.TCP_PORT}`);

    const app = await NestFactory.createMicroservice<MicroserviceOptions>(EmailBootstrapModule, {
        transport: Transport.TCP,
        options: {
            host: EMAIL_MS.TCP_HOST,
            port: EMAIL_MS.TCP_PORT,
        },
    });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    // Ensure the EmailMessages table exists before the microservice starts
    // serving requests. Run as part of the same lifecycle so failures crash
    // the process (and Docker restarts it cleanly).
    const dataSource = app.get(DataSource);
    await EmailMessageTypeOrmRepository.ensureTable(dataSource);

    await app.listen();
    logger.log(`Email microservice is listening on ${EMAIL_MS.TCP_HOST}:${EMAIL_MS.TCP_PORT}`);
}
bootstrap().catch((error) => {
    console.error('Failed to start Email microservice:', error);
    process.exit(1);
});