/**
 * VNPay Gateway Implementation Example
 * 
 * Đây là EXAMPLE để bạn hiểu cách implement gateway thực tế
 * 
 * Để sử dụng:
 * 1. Install VNPay SDK: npm install vnpay
 * 2. Copy file này thành vnpay.gateway.ts
 * 3. Uncomment và implement code thực tế
 * 4. Update payment-gateway.factory.ts để dùng VNPayGateway thay vì MockPaymentGateway
 */

import { Injectable, Logger } from '@nestjs/common';
import { IPaymentGateway, PaymentGatewayResponse, PaymentWebhookResult } from './payment-gateway.interface';
import { Payment } from 'src/shared/entities/payment/payment.entity';
import { Booking } from 'src/shared/entities/booking/booking.entity';
// import VNPay from 'vnpay'; // Uncomment khi install package

@Injectable()
export class VNPayGateway implements IPaymentGateway {
	private readonly logger = new Logger(VNPayGateway.name);
	// private readonly vnpay: VNPay; // Uncomment khi implement

	constructor() {
		// Initialize VNPay SDK
		// this.vnpay = new VNPay({
		//   tmnCode: process.env.VNPAY_TMN_CODE,
		//   secretKey: process.env.VNPAY_SECRET_KEY,
		//   testMode: process.env.NODE_ENV !== 'production',
		//   returnUrl: `${process.env.APP_URL}/payments/vnpay/callback`,
		// });
		this.logger.warn('[EXAMPLE] VNPayGateway is not fully implemented. This is just an example.');
	}

	async createPayment(payment: Payment, booking: Booking): Promise<PaymentGatewayResponse> {
		this.logger.log(`[VNPAY] Creating payment ${payment.payment_id} for booking ${booking.booking_id}`);

		try {
			// IMPLEMENT THẬT:
			// const paymentUrl = await this.vnpay.buildPaymentUrl({
			//   amount: Number(payment.amount),
			//   orderId: payment.payment_id,
			//   orderDescription: `Payment for booking ${booking.pnr_code}`,
			//   orderType: 'other',
			//   locale: 'vn',
			//   currCode: payment.currency.currency_code,
			//   returnUrl: `${process.env.APP_URL}/payments/vnpay/callback`,
			//   ipAddr: '127.0.0.1', // Get from request
			//   createDate: new Date().toISOString(),
			//   expireDate: payment.expires_at?.toISOString(),
			// });

			// const transactionId = payment.payment_id; // VNPay sẽ generate transaction ID

			// EXAMPLE CODE (chưa implement thật):
			const transactionId = `VNPAY-${Date.now()}-${payment.payment_id.substring(0, 8)}`;
			const paymentUrl = `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?${transactionId}`;

			return {
				transactionId,
				paymentUrl,
				status: 'pending',
				message: 'Redirect user to VNPay payment page',
			};
		} catch (error) {
			this.logger.error(`[VNPAY] Error creating payment: ${error.message}`, error.stack);
			throw error;
		}
	}

	verifyWebhook(signature: string, payload: any): boolean {
		this.logger.log(`[VNPAY] Verifying webhook signature`);

		try {
			// IMPLEMENT THẬT:
			// return this.vnpay.verifySignature(payload, signature);

			// EXAMPLE CODE (chưa implement thật):
			// VNPay sẽ gửi signature trong payload hoặc header
			// Bạn cần verify bằng secret key
			return true; // Placeholder
		} catch (error) {
			this.logger.error(`[VNPAY] Error verifying webhook: ${error.message}`);
			return false;
		}
	}

	async processWebhook(payload: any): Promise<PaymentWebhookResult> {
		this.logger.log(`[VNPAY] Processing webhook: ${JSON.stringify(payload)}`);

		try {
			// IMPLEMENT THẬT:
			// const result = this.vnpay.parseCallback(payload);
			// 
			// VNPay response format:
			// {
			//   vnp_Amount: '157700000', // Amount * 100 (VND)
			//   vnp_BankCode: 'NCB',
			//   vnp_BankTranNo: 'VNP12345678',
			//   vnp_CardType: 'ATM',
			//   vnp_OrderInfo: 'Payment for booking ABC123',
			//   vnp_PayDate: '20250120153000',
			//   vnp_ResponseCode: '00', // 00 = success
			//   vnp_TmnCode: 'xxx',
			//   vnp_TransactionNo: '12345678',
			//   vnp_TransactionStatus: '00',
			//   vnp_TxnRef: 'payment_id',
			//   vnp_SecureHash: 'signature'
			// }

			// const isSuccess = result.vnp_ResponseCode === '00';
			// const amount = Number(result.vnp_Amount) / 100; // Convert back from VND * 100

			// EXAMPLE CODE (chưa implement thật):
			const transactionId = payload.vnp_TxnRef || payload.transactionId;
			const isSuccess = payload.vnp_ResponseCode === '00' || payload.status === 'success';
			const amount = payload.vnp_Amount ? Number(payload.vnp_Amount) / 100 : payload.amount || 0;

			return {
				transactionId,
				status: isSuccess ? 'success' : 'failed',
				amount,
				currency: 'VND',
				message: isSuccess ? 'Payment successful' : 'Payment failed',
				gatewayData: payload,
			};
		} catch (error) {
			this.logger.error(`[VNPAY] Error processing webhook: ${error.message}`, error.stack);
			throw error;
		}
	}

	async processRefund(transactionId: string, amount: number): Promise<string> {
		this.logger.log(`[VNPAY] Processing refund for transaction ${transactionId}, amount: ${amount}`);

		try {
			// IMPLEMENT THẬT:
			// const refundResult = await this.vnpay.refund({
			//   transactionId,
			//   amount: amount * 100, // VNPay uses amount * 100
			//   transactionDate: new Date().toISOString(),
			// });

			// return refundResult.refundTransactionId;

			// EXAMPLE CODE (chưa implement thật):
			return `VNPAY-REFUND-${Date.now()}-${transactionId.substring(0, 8)}`;
		} catch (error) {
			this.logger.error(`[VNPAY] Error processing refund: ${error.message}`, error.stack);
			throw error;
		}
	}
}

/**
 * CÁCH SỬ DỤNG:
 * 
 * 1. Install VNPay SDK:
 *    npm install vnpay
 * 
 * 2. Thêm vào .env:
 *    VNPAY_TMN_CODE=your_tmn_code
 *    VNPAY_SECRET_KEY=your_secret_key
 *    APP_URL=http://localhost:3000
 * 
 * 3. Update payment-gateway.factory.ts:
 *    import { VNPayGateway } from './vnpay.gateway';
 *    
 *    case 'EWALLET':
 *      return new VNPayGateway(); // Thay MockPaymentGateway
 * 
 * 4. Test với VNPay Sandbox trước khi deploy production
 */

