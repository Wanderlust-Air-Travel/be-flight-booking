import { Injectable, Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { Payment } from 'src/shared/entities/payment/payment.entity';
import { Booking } from 'src/shared/entities/booking/booking.entity';
import { EMAIL_MS } from 'src/microservices/email/email.messages';
import { EmailTemplate } from 'src/shared/constants/enums';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * Payment Notification Service
 * Handles sending notifications for payment events via Email Microservice
 */
@Injectable()
export class PaymentNotificationService {
	private readonly logger = new Logger(PaymentNotificationService.name);

	constructor(
		@Inject('EMAIL_CLIENT') private readonly emailClient: ClientProxy,
		@InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
	) {}

	/**
	 * Send payment success notification
	 */
	async sendPaymentSuccessNotification(payment: Payment, booking: Booking): Promise<void> {
		this.logger.log(`Sending payment success notification for payment ${payment.payment_id}`);

		try {
			// Reload booking with full relations to include seat & cabin info for email
			const detailedBooking =
				(await this.bookingRepo.findOne({
					where: { booking_id: booking.booking_id },
					relations: [
						'currency',
						'booking_segments',
						'booking_segments.flight_instance',
						'booking_segments.flight_instance.flight_schedule',
						'booking_segments.flight_instance.flight_schedule.route',
						'booking_segments.flight_instance.flight_schedule.route.origin_airport',
						'booking_segments.flight_instance.flight_schedule.route.destination_airport',
						'booking_segments.fare_class',
						'booking_segments.flight_seat',
						'booking_segments.flight_seat.seat_config',
						'booking_segments.flight_seat.seat_config.cabin_class',
						'booking_passengers',
						'booking_passengers.passenger',
						'user',
					],
				})) || booking;

			const emailAddress = detailedBooking.contact_email || detailedBooking.user?.email;
			if (!emailAddress) {
				this.logger.warn(
					`Cannot send payment success notification: No email address found for booking ${booking.booking_id}`,
				);
				return;
			}

			const passengerName =
				detailedBooking.contact_fullname || detailedBooking.user?.fullname || 'Quý khách';

			// Build cabin & seat details per segment/passenger
			const seatDetails = this.formatSeatDetails(detailedBooking);

			// Send email via Email Microservice
			await firstValueFrom(
				this.emailClient.send(EMAIL_MS.PATTERN.SEND_EMAIL, {
					to: emailAddress,
					template: EmailTemplate.PAYMENT_SUCCESS,
					templateData: {
						pnrCode: detailedBooking.pnr_code,
						bookingId: detailedBooking.booking_id,
						totalAmount: payment.amount,
						currency: payment.currency.currency_code,
						passengerName,
						paymentMethod: payment.payment_method.name,
						transactionRef: payment.transaction_ref,
						seatDetails,
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
	 * Format seat & cabin details for payment success email
	 */
	private formatSeatDetails(booking: Booking): string {
		if (!booking.booking_segments || booking.booking_segments.length === 0) {
			return 'N/A';
		}

		const lines: string[] = [];

		for (const segment of booking.booking_segments) {
			const passengerName =
				segment.booking_passenger?.passenger?.fullname ||
				booking.contact_fullname ||
				booking.user?.fullname ||
				'Quý khách';

			const seatNumber =
				segment.flight_seat?.seat_number ||
				segment.flight_seat?.seat_config?.seat_number ||
				'Chưa chọn';

			const cabinClass =
				segment.flight_seat?.seat_config?.cabin_class?.description ||
				segment.flight_seat?.seat_config?.cabin_class?.cabin_class_code ||
				segment.fare_class?.description ||
				segment.fare_class?.fare_class_code ||
				'N/A';

			lines.push(
				`Hành khách: ${passengerName}\n` +
					`Cabin: ${cabinClass}\n` +
					`Số ghế: ${seatNumber}`,
			);
		}

		return lines.length > 0 ? lines.join('\n\n') : 'N/A';
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

