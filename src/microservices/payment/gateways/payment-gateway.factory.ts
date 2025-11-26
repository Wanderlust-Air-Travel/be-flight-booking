import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { IPaymentGateway } from '../interfaces/payment-gateway.interface';
import { VNPayGateway } from './vnpay.gateway';
import { MoMoGateway } from './momo.gateway';
import { DevPaymentGateway } from './dev-payment.gateway';

/**
 * Payment Gateway Factory
 * Creates appropriate payment gateway instance based on payment method code
 */
@Injectable()
export class PaymentGatewayFactory {
	private readonly logger = new Logger(PaymentGatewayFactory.name);

	constructor(
		private readonly vnpayGateway: VNPayGateway,
		private readonly momoGateway: MoMoGateway,
		private readonly devGateway: DevPaymentGateway,
	) {}

	/**
	 * Create payment gateway instance based on payment method code
	 * @param methodCode Payment method code
	 * @returns Payment gateway instance
	 */
	create(methodCode: string): IPaymentGateway {
		this.logger.log(`Creating payment gateway for method: ${methodCode}`);

		// In development/demo environment, always use DevPaymentGateway
		if (process.env.NODE_ENV !== 'production') {
			this.logger.log('[DevPaymentGateway] Using DevPaymentGateway for all methods (non-production)');
			return this.devGateway;
		}

		switch (methodCode.toUpperCase()) {
			case 'CREDIT_CARD':
			case 'DEBIT_CARD':
			case 'BANK_TRANSFER':
				// Use VNPay for card and bank transfer payments
				return this.vnpayGateway;

			case 'EWALLET':
				// Use MoMo for e-wallet payments
				return this.momoGateway;

			case 'CASH':
				// CASH is not processed via online gateway
				throw new BadRequestException(
					'Payment method CASH is not supported for online payment processing.',
				);

			default:
				this.logger.warn(`Unknown payment method: ${methodCode}`);
				throw new BadRequestException(
					`Unsupported payment method: ${methodCode}. Please choose a supported method.`,
				);
		}
	}

	/**
	 * Get gateway name from payment method code
	 * Used for webhook routing
	 */
	getGatewayName(methodCode: string): string {
		switch (methodCode.toUpperCase()) {
			case 'CREDIT_CARD':
			case 'DEBIT_CARD':
				return 'stripe'; // or 'vnpay', 'momo', etc.
			case 'BANK_TRANSFER':
				return 'bank';
			case 'EWALLET':
				return 'momo'; // or 'zalopay', etc.
			case 'CASH':
				return 'cash';
			default:
				return 'mock';
		}
	}
}

