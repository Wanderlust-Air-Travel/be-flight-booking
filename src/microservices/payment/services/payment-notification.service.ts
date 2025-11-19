import { Injectable, Logger } from '@nestjs/common';
import { Payment } from 'src/shared/entities/payment/payment.entity';
import { Booking } from 'src/shared/entities/booking/booking.entity';

/**
 * Payment Notification Service
 * Handles sending notifications for payment events
 * 
 * In production, this would integrate with:
 * - Email service (SendGrid, AWS SES, etc.)
 * - SMS service (Twilio, AWS SNS, etc.)
 * - Push notification service
 * - Notification microservice
 */
@Injectable()
export class PaymentNotificationService {
	private readonly logger = new Logger(PaymentNotificationService.name);

	/**
	 * Send payment success notification
	 */
	async sendPaymentSuccessNotification(payment: Payment, booking: Booking): Promise<void> {
		this.logger.log(`Sending payment success notification for payment ${payment.payment_id}`);

		// In production, send email/SMS to booking.contact_email
		// Example:
		// await this.emailService.send({
		//   to: booking.contact_email,
		//   template: 'payment-success',
		//   data: {
		//     pnrCode: booking.pnr_code,
		//     amount: payment.amount,
		//     paymentMethod: payment.payment_method.name,
		//     transactionRef: payment.transaction_ref
		//   }
		// });

		this.logger.log(
			`[MOCK] Payment success notification sent to ${booking.contact_email} for booking ${booking.pnr_code}`,
		);
	}

	/**
	 * Send payment failed notification
	 */
	async sendPaymentFailedNotification(payment: Payment, booking: Booking, reason?: string): Promise<void> {
		this.logger.log(`Sending payment failed notification for payment ${payment.payment_id}`);

		// In production, send email/SMS to booking.contact_email
		// Example:
		// await this.emailService.send({
		//   to: booking.contact_email,
		//   template: 'payment-failed',
		//   data: {
		//     pnrCode: booking.pnr_code,
		//     amount: payment.amount,
		//     paymentMethod: payment.payment_method.name,
		//     reason: reason || 'Payment processing failed'
		//   }
		// });

		this.logger.log(
			`[MOCK] Payment failed notification sent to ${booking.contact_email} for booking ${booking.pnr_code}. Reason: ${reason || 'Unknown'}`,
		);
	}

	/**
	 * Send payment pending notification
	 */
	async sendPaymentPendingNotification(payment: Payment, booking: Booking): Promise<void> {
		this.logger.log(`Sending payment pending notification for payment ${payment.payment_id}`);

		// In production, send email/SMS with payment URL
		// Example:
		// await this.emailService.send({
		//   to: booking.contact_email,
		//   template: 'payment-pending',
		//   data: {
		//     pnrCode: booking.pnr_code,
		//     amount: payment.amount,
		//     paymentUrl: paymentUrl,
		//     expiresAt: payment.expires_at
		//   }
		// });

		this.logger.log(
			`[MOCK] Payment pending notification sent to ${booking.contact_email} for booking ${booking.pnr_code}`,
		);
	}
}

