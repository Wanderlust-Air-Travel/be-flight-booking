import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { PaymentClientModule } from './payment.client.module';
import { PaymentController } from './payment.controller';

@Module({
    imports: [PaymentClientModule, RealtimeModule],
    controllers: [PaymentController],
})
export class PaymentModule {}
