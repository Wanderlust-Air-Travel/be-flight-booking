import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { SERVICES_MS } from 'src/microservices/services/services.messages';
import { ServicesController } from './services.controller';

@Module({
	imports: [
		ClientsModule.register([
			{
				name: 'SERVICES_CLIENT',
				transport: Transport.TCP,
				options: {
					host: SERVICES_MS.TCP_HOST,
					port: SERVICES_MS.TCP_PORT,
				},
			},
		]),
	],
	controllers: [ServicesController],
})
export class ServicesClientModule {}

