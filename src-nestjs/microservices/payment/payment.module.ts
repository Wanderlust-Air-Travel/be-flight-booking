import { Module } from '@nestjs/common';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { OutboxModule } from '../../../shared/modules/outbox/outbox.module';
import { CreatePaymentHandler } from './application/handlers/create-payment.handler';
import { ProcessPaymentHandler } from './application/handlers/process-payment.handler';
import { GetPaymentHandler } from './application/handlers/get-payment.handler';
import { GetPaymentsByBookingHandler } from './application/handlers/get-payments-by-booking.handler';
import { RefundPaymentHandler } from './application/handlers/refund-payment.handler';
import { HandleWebhookHandler } from './application/handlers/handle-webhook.handler';
import { InMemoryPaymentRepository } from './domain/repositories/in-memory-payment.repository';
import { DevPaymentGateway } from './infrastructure/adapters/dev-payment-gateway.adapter';
import { BookingTcpAdapter } from './infrastructure/adapters/booking-tcp.adapter';
import { PaymentMessageHandler } from './interface/payment.message-handler';

/**
 * PaymentModule — Wires the payment bounded context.
 *
 * Provides 6 use-case handlers, gateway port adapter, booking port adapter,
 * and TCP message handler interface.
 *
 * Old payment.service.ts (913 lines) is replaced by 6 single-purpose handlers.
 */
@Module({
    imports: [OutboxModule],
    controllers: [PaymentMessageHandler],
    providers: [
        CreatePaymentHandler,
        ProcessPaymentHandler,
        GetPaymentHandler,
        GetPaymentsByBookingHandler,
        RefundPaymentHandler,
        HandleWebhookHandler,

        InMemoryPaymentRepository,
        {
            provide: 'IPaymentRepository',
            useExisting: InMemoryPaymentRepository,
        },

        DevPaymentGateway,
        {
            provide: 'IPaymentGateway',
            useExisting: DevPaymentGateway,
        },

        // Cross-context: BookingTcpAdapter for ownership checks (avoids @InjectRepository(Booking))
        {
            provide: 'BOOKING_CLIENT',
            useFactory: () =>
                ClientProxyFactory.create({
                    transport: Transport.TCP,
                    options: { host: 'localhost', port: 4001 },
                }),
        },
        BookingTcpAdapter,
        {
            provide: 'IBookingPortForPayment',
            useExisting: BookingTcpAdapter,
        },
    ],
    exports: ['IPaymentRepository', 'IBookingPortForPayment'],
})
export class PaymentModule {}