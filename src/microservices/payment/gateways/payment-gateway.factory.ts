import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { IPaymentGateway } from '../interfaces/payment-gateway.interface';
import { MockPaymentGateway } from './mock-payment.gateway';
// Import actual payment gateways here when implemented
// import { VNPayGateway } from './vnpay.gateway';
// import { MoMoGateway } from './momo.gateway';
// import { StripeGateway } from './stripe.gateway';

/**
 * Payment Gateway Factory
 * Creates appropriate payment gateway instance based on payment method code
 */
@Injectable()
export class PaymentGatewayFactory {
	private readonly logger = new Logger(PaymentGatewayFactory.name);

	constructor(private readonly mockGateway: MockPaymentGateway) {}

	/**
	 * Create payment gateway instance based on payment method code
	 * @param methodCode Payment method code
	 * @returns Payment gateway instance
	 */
	create(methodCode: string): IPaymentGateway {
		this.logger.log(`Creating payment gateway for method: ${methodCode}`);

		switch (methodCode.toUpperCase()) {
			case 'CREDIT_CARD':
			case 'DEBIT_CARD':
				// In production, return StripeGateway or other card gateway
				// return new StripeGateway();
				return this.mockGateway;

			case 'BANK_TRANSFER':
				// In production, return bank transfer gateway
				// return new BankTransferGateway();
				return this.mockGateway;

			case 'EWALLET':
				// In production, return e-wallet gateway (MoMo, ZaloPay, etc.)
				// return new MoMoGateway();
				return this.mockGateway;

			case 'CASH':
				// Cash payments don't need gateway, but we can use mock for consistency
				return this.mockGateway;

			default:
				this.logger.warn(`Unknown payment method: ${methodCode}, using mock gateway`);
				return this.mockGateway;
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

