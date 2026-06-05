import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PAYMENT_MS } from 'src/microservices/payment/payment.messages';

@Module({
    imports: [
        ClientsModule.register([
            {
                name: 'PAYMENT_CLIENT',
                transport: Transport.TCP,
                options: {
                    host: PAYMENT_MS.TCP_HOST,
                    port: PAYMENT_MS.TCP_PORT,
                },
            },
        ]),
    ],
    exports: [ClientsModule],
})
export class PaymentClientModule {}
