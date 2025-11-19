import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentClientModule } from './payment.client.module';

@Module({
	imports: [PaymentClientModule],
	controllers: [PaymentController],
})
export class PaymentModule {}

