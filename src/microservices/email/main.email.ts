import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env file from project root (works with ts-node)
config({ path: resolve(process.cwd(), '.env') });

import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { EmailModule } from './email.module';
import { EMAIL_MS } from './email.messages';
import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';

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

