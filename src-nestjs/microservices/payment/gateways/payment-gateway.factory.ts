import { Injectable, Logger } from '@nestjs/common';
import { IPaymentGateway } from '../interfaces/payment-gateway.interface';
import { DevPaymentGateway } from './dev-payment.gateway';

/**
 * Payment Gateway Factory
 * Creates appropriate payment gateway instance based on payment method code
 * Currently only supports DevPaymentGateway for development/demo purposes
 */
@Injectable()
export class PaymentGatewayFactory {
	private readonly logger = new Logger(PaymentGatewayFactory.name);

	constructor(
		private readonly devGateway: DevPaymentGateway,
	) {}

	/**
	 * Create payment gateway instance based on payment method code
	 * Always returns DevPaymentGateway for all payment methods
	 * @param methodCode Payment method code
	 * @returns Payment gateway instance (DevPaymentGateway)
	 */
	create(methodCode: string): IPaymentGateway {
		this.logger.log(`Creating payment gateway for method: ${methodCode}`);
		this.logger.log('[DevPaymentGateway] Using DevPaymentGateway for all payment methods');
		return this.devGateway;
	}

	/**
	 * Get gateway name from payment method code
	 * Used for webhook routing
	 * Always returns 'dev' for all payment methods
	 */
	getGatewayName(methodCode: string): string {
		return 'dev';
	}
}

