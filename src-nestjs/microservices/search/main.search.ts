import { resolve } from 'node:path';
import { config } from 'dotenv';

// Load .env file from project root (works with ts-node)
config({ path: resolve(process.cwd(), '.env') });

import { Logger, ValidationPipe } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { type MicroserviceOptions, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SEARCH_MS } from './search.messages';
import { SearchModule } from './search.module';
import { IncomingRequestDeserializer } from './deserializers/incoming-request.deserializer';

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
            entities: [
                `${__dirname}/../../api-gateway/data-access/entities/**/*.entity.{ts,js}`,
                `${__dirname}/../../shared/infrastructure/persistence/typeorm/entities/*.entity.{ts,js}`,
            ],
        }),
        SearchModule,
    ],
})
class SearchBootstrapModule {}

async function bootstrap() {
    const logger = new Logger('SearchBootstrap');
    logger.log('Starting Search microservice...');
    logger.log(`TCP Host: ${SEARCH_MS.TCP_HOST}, Port: ${SEARCH_MS.TCP_PORT}`);

    const app = await NestFactory.createMicroservice<MicroserviceOptions>(SearchBootstrapModule, {
        transport: Transport.TCP,
        options: {
            host: SEARCH_MS.TCP_HOST,
            port: SEARCH_MS.TCP_PORT,
            deserializer: new IncomingRequestDeserializer(),
        },
    });

    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));
    await app.listen();
    logger.log(`Search microservice is listening on ${SEARCH_MS.TCP_HOST}:${SEARCH_MS.TCP_PORT}`);
}
bootstrap().catch((error) => {
    console.error('Failed to start Search microservice:', error);
    process.exit(1);
});
