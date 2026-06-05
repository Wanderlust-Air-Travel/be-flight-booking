import { resolve } from 'node:path';
import { config } from 'dotenv';

// Load .env file from project root (works with ts-node)
config({ path: resolve(process.cwd(), '.env') });

import { ValidationPipe } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { type MicroserviceOptions, Transport } from '@nestjs/microservices';
import { EMAIL_MS } from './email.messages';
import { EmailModule } from './email.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        EmailModule,
    ],
})
class EmailBootstrapModule {}

async function bootstrap() {
    const app = await NestFactory.createMicroservice<MicroserviceOptions>(EmailBootstrapModule, {
        transport: Transport.TCP,
        options: {
            host: EMAIL_MS.TCP_HOST,
            port: EMAIL_MS.TCP_PORT,
        },
    });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen();
    console.log(`Email microservice is listening on ${EMAIL_MS.TCP_HOST}:${EMAIL_MS.TCP_PORT}`);
}
bootstrap().catch((error) => {
    console.error('Failed to start Email microservice:', error);
    process.exit(1);
});
