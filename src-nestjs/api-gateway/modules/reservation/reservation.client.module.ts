import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RESERVATION_MS } from 'src/microservices/reservation/reservation.messages';
import { ReservationController } from './reservation.controller';

@Module({
    imports: [
        ClientsModule.register([
            {
                name: 'RESERVATION_CLIENT',
                transport: Transport.TCP,
                options: {
                    host: RESERVATION_MS.TCP_HOST,
                    port: RESERVATION_MS.TCP_PORT,
                },
            },
        ]),
    ],
    controllers: [ReservationController],
})
export class ReservationClientModule {}
