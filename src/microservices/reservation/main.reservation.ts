import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env file from project root (works with ts-node)
config({ path: resolve(process.cwd(), '.env') });

import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ReservationModule } from './reservation.module';
import { RESERVATION_MS } from './reservation.messages';
import { ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { RedisModule } from 'src/shared/modules/redis/redis.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
		}),
		// Reuse the same global TypeORM configuration via AppModule pattern:
		TypeOrmModule.forRoot({
			type: 'mssql',
			host: process.env.DB_HOST ?? 'localhost',
			port: Number(process.env.DB_PORT ?? 1434),
			username: process.env.DB_USER,
			password: process.env.DB_PASS,
			database: process.env.DB_NAME,
			options: {
				encrypt: process.env.DB_ENCRYPT === 'true',
				trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
			},
			synchronize: false,
			entities: [__dirname + '/../../shared/entities/**/*.entity.{ts,js}'],
		}),
		RedisModule,
		ReservationModule,
	],
})
class ReservationBootstrapModule {}

async function bootstrap() {
	const app = await NestFactory.createMicroservice<MicroserviceOptions>(ReservationBootstrapModule, {
		transport: Transport.TCP,
		options: {
			host: RESERVATION_MS.TCP_HOST,
			port: RESERVATION_MS.TCP_PORT,
		},
	});
	app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
	await app.listen();
	console.log(
		`Reservation microservice is listening on ${RESERVATION_MS.TCP_HOST}:${RESERVATION_MS.TCP_PORT}`,
	);
}
bootstrap().catch((error) => {
	console.error('Failed to start Reservation microservice:', error);
	process.exit(1);
});

