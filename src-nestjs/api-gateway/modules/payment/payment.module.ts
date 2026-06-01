import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentClientModule } from './payment.client.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
	imports: [PaymentClientModule, RealtimeModule],
	controllers: [PaymentController],
})
export class PaymentModule {}

