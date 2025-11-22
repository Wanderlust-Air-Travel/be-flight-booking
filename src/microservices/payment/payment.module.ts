import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Payment } from 'src/shared/entities/payment/payment.entity';
import { PaymentMethod } from 'src/shared/entities/payment/payment-method.entity';
import { Booking } from 'src/shared/entities/booking/booking.entity';
import { Currency } from 'src/shared/entities/currency/currency.entity';
import { RedisModule } from 'src/shared/modules/redis/redis.module';
import { EmailClientModule } from 'src/shared/modules/email-client/email-client.module';
import { PaymentService } from './payment.service';
import { PaymentMsController } from './payment.controller';
import { BOOKING_MS } from '../booking/booking.messages';
import { EMAIL_MS } from '../email/email.messages';
import { PaymentValidationService } from './services/payment-validation.service';
import { PaymentNotificationService } from './services/payment-notification.service';
import { PaymentGatewayFactory } from './gateways/payment-gateway.factory';
import { MockPaymentGateway } from './gateways/mock-payment.gateway';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
		}),
		TypeOrmModule.forFeature([Payment, PaymentMethod, Booking, Currency]),
		RedisModule, // Add Redis module for idempotency key caching
		EmailClientModule, // Add Email Client module for sending email notifications
		ClientsModule.register([
			{
				name: 'BOOKING_CLIENT',
				transport: Transport.TCP,
				options: {
					host: BOOKING_MS.TCP_HOST,
					port: BOOKING_MS.TCP_PORT,
				},
			},
			{
				name: 'EMAIL_CLIENT',
				transport: Transport.TCP,
				options: {
					host: EMAIL_MS.TCP_HOST,
					port: EMAIL_MS.TCP_PORT,
				},
			},
		]),
	],
	providers: [
		PaymentService,
		PaymentValidationService,
		PaymentNotificationService,
		MockPaymentGateway,
		PaymentGatewayFactory,
	],
	controllers: [PaymentMsController],
	exports: [PaymentService],
})
export class PaymentModule {}

