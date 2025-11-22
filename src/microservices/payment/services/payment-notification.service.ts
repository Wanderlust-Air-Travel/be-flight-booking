import { Injectable, Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { Payment } from 'src/shared/entities/payment/payment.entity';
import { Booking } from 'src/shared/entities/booking/booking.entity';
import { EMAIL_MS } from 'src/microservices/email/email.messages';
import { EmailTemplate } from 'src/shared/constants/enums';

/**
 * Payment Notification Service
 * Handles sending notifications for payment events via Email Microservice
 */
@Injectable()
export class PaymentNotificationService {
	private readonly logger = new Logger(PaymentNotificationService.name);

	constructor(
		@Inject('EMAIL_CLIENT') private readonly emailClient: ClientProxy,
	) {}

	/**
	 * Send payment success notification
	 */
	async sendPaymentSuccessNotification(payment: Payment, booking: Booking): Promise<void> {
		this.logger.log(`Sending payment success notification for payment ${payment.payment_id}`);

		try {
			const emailAddress = booking.contact_email || booking.user?.email;
			if (!emailAddress) {
				this.logger.warn(
					`Cannot send payment success notification: No email address found for booking ${booking.booking_id}`,
				);
				return;
			}

			const passengerName = booking.contact_fullname || booking.user?.fullname || 'Quý khách';

			// Send email via Email Microservice
			await firstValueFrom(
				this.emailClient.send(EMAIL_MS.PATTERN.SEND_EMAIL, {
					to: emailAddress,
					template: EmailTemplate.PAYMENT_SUCCESS,
					templateData: {
						pnrCode: booking.pnr_code,
						bookingId: booking.booking_id,
						totalAmount: payment.amount,
						currency: payment.currency.currency_code,
						passengerName,
						paymentMethod: payment.payment_method.name,
						transactionRef: payment.transaction_ref,
					},
				}),
			);

			this.logger.log(
				`Payment success notification sent to ${emailAddress} for booking ${booking.pnr_code}`,
			);
		} catch (error: any) {
			// Log error but don't throw - notification failure shouldn't break payment flow
			this.logger.error(
				`Failed to send payment success notification: ${error.message}`,
				error.stack,
			);
		}
	}

	/**
	 * Send payment failed notification
	 */
	async sendPaymentFailedNotification(payment: Payment, booking: Booking, reason?: string): Promise<void> {
		this.logger.log(`Sending payment failed notification for payment ${payment.payment_id}`);

		try {
			const emailAddress = booking.contact_email || booking.user?.email;
			if (!emailAddress) {
				this.logger.warn(
					`Cannot send payment failed notification: No email address found for booking ${booking.booking_id}`,
				);
				return;
			}

			// Send email via Email Microservice
			await firstValueFrom(
				this.emailClient.send(EMAIL_MS.PATTERN.SEND_EMAIL, {
					to: emailAddress,
					template: EmailTemplate.PAYMENT_FAILED,
					templateData: {
						bookingId: booking.booking_id,
						pnrCode: booking.pnr_code,
						amount: payment.amount,
						paymentMethod: payment.payment_method.name,
						reason: reason || 'Payment processing failed',
					},
				}),
			);

			this.logger.log(
				`Payment failed notification sent to ${emailAddress} for booking ${booking.pnr_code}. Reason: ${reason || 'Unknown'}`,
			);
		} catch (error: any) {
			// Log error but don't throw - notification failure shouldn't break payment flow
			this.logger.error(
				`Failed to send payment failed notification: ${error.message}`,
				error.stack,
			);
		}
	}

	/**
	 * Send payment pending notification
	 * Optional: Can be used to notify user about pending payment with payment URL
	 */
	async sendPaymentPendingNotification(payment: Payment, booking: Booking): Promise<void> {
		this.logger.log(`Sending payment pending notification for payment ${payment.payment_id}`);

		// Note: Payment pending notification is optional - we don't send email for pending payments
		// Users can see pending payment status in their booking details
		// This method is kept for future use or custom implementations
		
		this.logger.log(
			`Payment pending notification logged for booking ${booking.pnr_code} (email notification skipped)`,
		);
	}
}

