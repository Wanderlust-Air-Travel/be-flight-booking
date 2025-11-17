import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { BOOKING_MS } from 'src/microservices/booking/booking.messages';
import { BookingController } from './booking.controller';

@Module({
	imports: [
		ClientsModule.register([
			{
				name: 'BOOKING_CLIENT',
				transport: Transport.TCP,
				options: {
					host: BOOKING_MS.TCP_HOST,
					port: BOOKING_MS.TCP_PORT,
				},
			},
		]),
	],
	controllers: [BookingController],
})
export class BookingClientModule {}

