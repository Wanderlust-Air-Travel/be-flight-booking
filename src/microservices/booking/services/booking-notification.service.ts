import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { Booking } from 'src/shared/entities/booking/booking.entity';
import { EMAIL_MS } from 'src/microservices/email/email.messages';
import { EmailTemplate } from 'src/shared/constants/enums';
import { RabbitMQPublisherService } from 'src/shared/modules/rabbitmq/rabbitmq-publisher.service';

/**
 * Booking Notification Service
 * Handles sending notifications for booking events via Email Microservice
 * Uses RabbitMQ (preferred) or TCP (fallback) for async email sending
 */
@Injectable()
export class BookingNotificationService {
	private readonly logger = new Logger(BookingNotificationService.name);

	constructor(
		@Optional() private readonly rabbitMQPublisher: RabbitMQPublisherService | null,
		@Optional() @Inject('EMAIL_CLIENT') private readonly emailClient: ClientProxy | null,
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

		// Send email via RabbitMQ (preferred) or TCP (fallback)
		const emailDto = {
			to: emailAddress,
			template: EmailTemplate.TICKET_CONFIRMATION,
			templateData: {
				pnrCode: booking.pnr_code,
				bookingId: booking.booking_id,
				totalAmount: booking.total_amount,
				currency: booking.currency.currency_code,
				passengerName,
				flightDetails,
			},
		};

		// Try RabbitMQ first (preferred)
		if (this.rabbitMQPublisher) {
			try {
				await this.rabbitMQPublisher.publishEmail(emailDto);
				this.logger.log(
					`Booking confirmation queued via RabbitMQ to ${emailAddress} for booking ${booking.pnr_code}`,
				);
				return;
			} catch (error: any) {
				this.logger.warn(`RabbitMQ email publishing failed, falling back to TCP: ${error.message}`);
			}
		}

		// Fallback to TCP
		if (this.emailClient) {
			await firstValueFrom(this.emailClient.send(EMAIL_MS.PATTERN.SEND_EMAIL, emailDto));
			this.logger.log(
				`Booking confirmation sent via TCP to ${emailAddress} for booking ${booking.pnr_code}`,
			);
		} else {
			this.logger.error('No email client available (neither RabbitMQ nor TCP)');
		}
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

	/**
	 * Send ticket confirmation email with detailed information
	 * Called after tickets are successfully created
	 */
	async sendTicketConfirmation(booking: Booking, tickets: any[]): Promise<void> {
		this.logger.log(`Sending ticket confirmation for booking ${booking.booking_id}`);

		try {
			const emailAddress = booking.contact_email || booking.user?.email;
			if (!emailAddress) {
				this.logger.warn(
					`Cannot send ticket confirmation: No email address found for booking ${booking.booking_id}`,
				);
				return;
			}

			const passengerName = booking.contact_fullname || booking.user?.fullname || 'Quý khách';

			// Format detailed ticket information
			const ticketDetails = this.formatTicketDetails(booking, tickets);

			// Calculate check-in time (2 hours before departure for domestic, 3 hours for international)
			const checkInTime = this.calculateCheckInTime(booking);

			// Send email via RabbitMQ (preferred) or TCP (fallback)
			const emailDto = {
				to: emailAddress,
				template: EmailTemplate.TICKET_CONFIRMATION,
				templateData: {
					passengerName,
					ticketDetails,
					checkInTime,
				},
			};

			// Try RabbitMQ first (preferred)
			if (this.rabbitMQPublisher) {
				try {
					await this.rabbitMQPublisher.publishEmail(emailDto);
					this.logger.log(
						`Ticket confirmation queued via RabbitMQ to ${emailAddress} for booking ${booking.pnr_code} with ${tickets.length} tickets`,
					);
					return;
				} catch (error: any) {
					this.logger.warn(`RabbitMQ email publishing failed, falling back to TCP: ${error.message}`);
				}
			}

			// Fallback to TCP
			if (this.emailClient) {
				await firstValueFrom(this.emailClient.send(EMAIL_MS.PATTERN.SEND_EMAIL, emailDto));
				this.logger.log(
					`Ticket confirmation sent via TCP to ${emailAddress} for booking ${booking.pnr_code} with ${tickets.length} tickets`,
				);
			} else {
				this.logger.error('No email client available (neither RabbitMQ nor TCP)');
			}
		} catch (error: any) {
			// Log error but don't throw - notification failure shouldn't break ticket creation flow
			this.logger.error(
				`Failed to send ticket confirmation: ${error.message}`,
				error.stack,
			);
		}
	}

	/**
	 * Format detailed ticket information for email
	 */
	private formatTicketDetails(booking: Booking, tickets: any[]): any[] {
		if (!booking.booking_segments || booking.booking_segments.length === 0) {
			return [];
		}

		const ticketDetails: any[] = [];

		// Map tickets to segments
		for (const segment of booking.booking_segments) {
			const ticket = tickets.find(
				(t) => t.booking_passenger.booking_passenger_id === segment.booking_passenger.booking_passenger_id,
			);

			if (!ticket) continue;

			const flightInstance = segment.flight_instance;
			if (!flightInstance) continue;

			const schedule = flightInstance.flight_schedule;
			const route = schedule?.route;
			const fareClass = segment.fare_class;

			if (!route || !route.origin_airport || !route.destination_airport) continue;

			// Format times
			const departureTime = flightInstance.departure_datetime_local
				? new Date(flightInstance.departure_datetime_local).toLocaleString('vi-VN', {
						weekday: 'long',
						year: 'numeric',
						month: 'long',
						day: 'numeric',
						hour: '2-digit',
						minute: '2-digit',
					})
				: 'N/A';

			const arrivalTime = flightInstance.arrival_datetime_local
				? new Date(flightInstance.arrival_datetime_local).toLocaleString('vi-VN', {
						weekday: 'long',
						year: 'numeric',
						month: 'long',
						day: 'numeric',
						hour: '2-digit',
						minute: '2-digit',
					})
				: 'N/A';

			// Get fare class name
			const fareClassName = fareClass?.description || fareClass?.fare_class_code || 'N/A';

			// Get cabin class
			const cabinClass =
				fareClass?.cabin_class?.cabin_class_code === 'Y'
					? 'economy'
					: fareClass?.cabin_class?.cabin_class_code === 'C'
						? 'business'
						: 'economy';

			// Get seat number
			const seatNumber = segment.flight_seat?.seat_number || 'Chưa chọn';

			// Get passenger name
			const passengerName =
				segment.booking_passenger?.passenger?.fullname ||
				booking.contact_fullname ||
				booking.user?.fullname ||
				'Quý khách';

			ticketDetails.push({
				ticketNumber: ticket.ticket_number,
				passengerName,
				flightNumber: schedule?.flight_number || flightInstance.flight_number || 'N/A',
				originAirport: route.origin_airport.iata_code || 'N/A',
				originAirportName: route.origin_airport.name || '',
				originCity: route.origin_airport.city || '',
				destinationAirport: route.destination_airport.iata_code || 'N/A',
				destinationAirportName: route.destination_airport.name || '',
				destinationCity: route.destination_airport.city || '',
				departureTime,
				arrivalTime,
				fareClassName,
				cabinClass,
				seatNumber,
			});
		}

		return ticketDetails;
	}

	/**
	 * Calculate check-in time based on flight departure time and route type
	 * Domestic: 2 hours before, International: 3 hours before
	 */
	private calculateCheckInTime(booking: Booking): string {
		if (!booking.booking_segments || booking.booking_segments.length === 0) {
			return 'N/A';
		}

		// Get first segment to determine check-in time
		const firstSegment = booking.booking_segments[0];
		const flightInstance = firstSegment?.flight_instance;
		const route = flightInstance?.flight_schedule?.route;

		if (!flightInstance?.departure_datetime_local || !route) {
			return 'N/A';
		}

		const departureTime = new Date(flightInstance.departure_datetime_local);
		const isDomestic = route.is_domestic;

		// Calculate check-in time (2 hours for domestic, 3 hours for international)
		const checkInHours = isDomestic ? 2 : 3;
		const checkInTime = new Date(departureTime.getTime() - checkInHours * 60 * 60 * 1000);

		return checkInTime.toLocaleString('vi-VN', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	}

	/**
	 * Send booking cancellation email with refund information
	 */
	async sendCancellationNotification(
		booking: Booking,
		refundAmount: number,
		cancellationFee: number,
	): Promise<void> {
		this.logger.log(`Sending cancellation notification for booking ${booking.booking_id}`);

		try {
			const emailAddress = booking.contact_email || booking.user?.email;
			if (!emailAddress) {
				this.logger.warn(
					`Cannot send cancellation notification: No email address found for booking ${booking.booking_id}`,
				);
				return;
			}

			const passengerName = booking.contact_fullname || booking.user?.fullname || 'Quý khách';

			// Format flight details from booking segments
			const flightDetails = this.formatFlightDetails(booking);

			// Send email via RabbitMQ (preferred) or TCP (fallback)
			const emailDto = {
				to: emailAddress,
				template: EmailTemplate.BOOKING_CANCELLATION,
				templateData: {
					passengerName,
					pnrCode: booking.pnr_code,
					bookingId: booking.booking_id,
					totalAmount: booking.total_amount,
					refundAmount,
					cancellationFee,
					currency: booking.currency.currency_code,
					flightDetails,
				},
			};

			// Try RabbitMQ first (preferred)
			if (this.rabbitMQPublisher) {
				try {
					await this.rabbitMQPublisher.publishEmail(emailDto);
					this.logger.log(
						`Cancellation notification queued via RabbitMQ to ${emailAddress} for booking ${booking.pnr_code}`,
					);
					return;
				} catch (error: any) {
					this.logger.warn(`RabbitMQ email publishing failed, falling back to TCP: ${error.message}`);
				}
			}

			// Fallback to TCP
			if (this.emailClient) {
				await firstValueFrom(this.emailClient.send(EMAIL_MS.PATTERN.SEND_EMAIL, emailDto));
				this.logger.log(
					`Cancellation notification sent via TCP to ${emailAddress} for booking ${booking.pnr_code}`,
				);
			} else {
				this.logger.error('No email client available (neither RabbitMQ nor TCP)');
			}
		} catch (error: any) {
			// Log error but don't throw - notification failure shouldn't break cancellation flow
			this.logger.error(
				`Failed to send cancellation notification: ${error.message}`,
				error.stack,
			);
		}
	}
}

