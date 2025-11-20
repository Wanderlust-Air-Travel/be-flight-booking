import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EMAIL_MS } from 'src/microservices/email/email.messages';
import { EmailController } from './email.controller';

@Module({
	imports: [
		ClientsModule.register([
			{
				name: 'EMAIL_CLIENT',
				transport: Transport.TCP,
				options: {
					host: EMAIL_MS.TCP_HOST,
					port: EMAIL_MS.TCP_PORT,
				},
			},
		]),
	],
	controllers: [EmailController],
})
export class EmailClientModule {}

