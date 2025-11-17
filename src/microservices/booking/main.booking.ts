import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env file from project root (works with ts-node)
config({ path: resolve(process.cwd(), '.env') });

import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { BookingModule } from './booking.module';
import { BOOKING_MS } from './booking.messages';
import { ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';

@Module({
	imports: [
		// Reuse the same global TypeORM configuration via AppModule pattern:
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
			entities: [__dirname + '/../../shared/entities/**/*.entity.{ts,js}'],
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
	await app.listen();
	console.log(`Booking microservice is listening on ${BOOKING_MS.TCP_HOST}:${BOOKING_MS.TCP_PORT}`);
}
bootstrap().catch((error) => {
	console.error('Failed to start Booking microservice:', error);
	process.exit(1);
});

