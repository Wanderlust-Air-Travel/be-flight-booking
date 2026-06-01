import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { RoutesModule } from './routes.module';
import { ROUTES_MS } from './routes.messages';
import { ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';

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
			entities: [__dirname + '/../../shared/entities/**/*.entity.{ts,js}'],
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

