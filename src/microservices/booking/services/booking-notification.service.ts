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

		// Format flight details from booking segments
		const flightDetails = this.formatFlightDetails(booking);

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
					flightDetails,
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

	/**
	 * Format flight details from booking segments
	 */
	private formatFlightDetails(booking: Booking): string {
		if (!booking.booking_segments || booking.booking_segments.length === 0) {
			return 'N/A';
		}

		const segments = booking.booking_segments;
		const flightDetails: string[] = [];

		// Group segments by flight instance (to avoid duplicates)
		const uniqueFlights = new Map<string, typeof segments[0]>();
		for (const segment of segments) {
			const flightInstanceId = segment.flight_instance?.flight_instance_id;
			if (flightInstanceId && !uniqueFlights.has(flightInstanceId)) {
				uniqueFlights.set(flightInstanceId, segment);
			}
		}

		for (const segment of uniqueFlights.values()) {
			const flightInstance = segment.flight_instance;
			if (!flightInstance) continue;

			const schedule = flightInstance.flight_schedule;
			const route = schedule?.route;
			const fareClass = segment.fare_class;

			if (route && route.origin_airport && route.destination_airport) {
				const origin = route.origin_airport.iata_code || route.origin_airport.name;
				const destination = route.destination_airport.iata_code || route.destination_airport.name;
				const flightNumber = schedule?.flight_number || flightInstance.flight_number || 'N/A';
				const departureTime = flightInstance.departure_datetime_local 
					? new Date(flightInstance.departure_datetime_local).toLocaleString('vi-VN', {
							dateStyle: 'short',
							timeStyle: 'short',
						})
					: 'N/A';
				const arrivalTime = flightInstance.arrival_datetime_local
					? new Date(flightInstance.arrival_datetime_local).toLocaleString('vi-VN', {
							dateStyle: 'short',
							timeStyle: 'short',
						})
					: 'N/A';
				const fareClassName = fareClass?.description || fareClass?.fare_class_code || 'N/A';

				flightDetails.push(
					`Chuyến bay: ${flightNumber}\n` +
					`Từ: ${origin} → Đến: ${destination}\n` +
					`Khởi hành: ${departureTime}\n` +
					`Đến nơi: ${arrivalTime}\n` +
					`Hạng vé: ${fareClassName}`
				);
			}
		}

		return flightDetails.length > 0 ? flightDetails.join('\n\n') : 'N/A';
	}
}

