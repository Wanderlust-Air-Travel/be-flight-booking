import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BOOKING_MS } from 'src/microservices/booking/booking.messages';
import { BookingController } from './booking.controller';
import { User } from 'src/shared/entities/user/user.entity';
import { Passenger } from 'src/shared/entities/passenger/passenger.entity';

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
		TypeOrmModule.forFeature([User, Passenger]), // For accessing User and Passenger repositories
	],
	controllers: [BookingController],
})
export class BookingClientModule {}

