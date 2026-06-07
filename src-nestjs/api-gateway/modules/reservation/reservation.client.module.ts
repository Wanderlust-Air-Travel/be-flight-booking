import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RESERVATION_MS } from 'src/microservices/reservation/reservation.messages';
import { RealtimeModule } from '../realtime/realtime.module';
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
        RealtimeModule,
    ],
    controllers: [ReservationController],
})
export class ReservationClientModule {}
