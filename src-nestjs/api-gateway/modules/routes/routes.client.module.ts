import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ROUTES_MS } from 'src/microservices/routes/routes.messages';
import { RoutesController } from './routes.controller';

@Module({
    imports: [
        ClientsModule.register([
            {
                name: 'ROUTES_CLIENT',
                transport: Transport.TCP,
                options: {
                    host: ROUTES_MS.TCP_PEER_HOST,
                    port: ROUTES_MS.TCP_PORT,
                },
            },
        ]),
    ],
    controllers: [RoutesController],
})
export class RoutesClientModule {}
