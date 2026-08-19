import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BOOKING_MS } from 'src/microservices/booking/booking.messages';
import { Passenger } from 'src/api-gateway/data-access/entities/passenger/passenger.entity';
import { User } from 'src/api-gateway/data-access/entities/user/user.entity';
import { AuthModule } from '../auth/auth.module';
import { BookingController } from './booking.controller';

@Module({
    imports: [
        ClientsModule.register([
            {
                name: 'BOOKING_CLIENT',
                transport: Transport.TCP,
                options: {
                    host: BOOKING_MS.TCP_PEER_HOST,
                    port: BOOKING_MS.TCP_PORT,
                },
            },
        ]),
        TypeOrmModule.forFeature([User, Passenger]), // For accessing User and Passenger repositories
        AuthModule, // Import AuthModule to use AuthService for OTP verification
    ],
    controllers: [BookingController],
})
export class BookingClientModule {}
