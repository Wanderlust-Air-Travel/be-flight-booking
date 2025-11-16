import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env file from project root (works with ts-node)
config({ path: resolve(process.cwd(), '.env') });

import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SearchModule } from './search.module';
import { SEARCH_MS } from './search.messages';
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
			entities: [__dirname + '/../../**/*.entity.{ts,js}'],
		}),
		SearchModule,
	],
})
class SearchBootstrapModule {}

async function bootstrap() {
	const app = await NestFactory.createMicroservice<MicroserviceOptions>(SearchBootstrapModule, {
		transport: Transport.TCP,
		options: {
			host: SEARCH_MS.TCP_HOST,
			port: SEARCH_MS.TCP_PORT,
		},
	});
	app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
	await app.listen();
}
bootstrap();


