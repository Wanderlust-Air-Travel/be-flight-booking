import { Injectable, Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { Booking } from 'src/shared/entities/booking/booking.entity';
import { EMAIL_MS } from 'src/microservices/email/email.messages';
import { EmailTemplate } from 'src/shared/constants/enums';

/**
 * Booking Notification Service
 * Handles sending notifications for booking events via Email Microservice
 */
@Injectable()
export class BookingNotificationService {
	private readonly logger = new Logger(BookingNotificationService.name);

	constructor(
		@Inject('EMAIL_CLIENT') private readonly emailClient: ClientProxy,
	) {}

	/**
	 * Send booking confirmation email
	 */
	async sendBookingConfirmation(booking: Booking): Promise<void> {
		this.logger.log(`Sending booking confirmation for booking ${booking.booking_id}`);

		try {
			const emailAddress = booking.contact_email || booking.user?.email;
			if (!emailAddress) {
				this.logger.warn(
					`Cannot send booking confirmation: No email address found for booking ${booking.booking_id}`,
				);
				return;
			}

			const passengerName = booking.contact_fullname || booking.user?.fullname || 'Quý khách';

			// Send email via Email Microservice
			await firstValueFrom(
				this.emailClient.send(EMAIL_MS.PATTERN.SEND_EMAIL, {
					to: emailAddress,
					template: EmailTemplate.BOOKING_CONFIRMATION,
					templateData: {
						pnrCode: booking.pnr_code,
						bookingId: booking.booking_id,
						totalAmount: booking.total_amount,
						currency: booking.currency.currency_code,
						passengerName,
					},
				}),
			);

			this.logger.log(
				`Booking confirmation sent to ${emailAddress} for booking ${booking.pnr_code}`,
			);
		} catch (error: any) {
			// Log error but don't throw - notification failure shouldn't break booking flow
			this.logger.error(
				`Failed to send booking confirmation: ${error.message}`,
				error.stack,
			);
		}
	}
}

