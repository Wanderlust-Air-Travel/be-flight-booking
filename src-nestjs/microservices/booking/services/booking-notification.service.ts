import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { Booking } from 'src/shared/entities/booking/booking.entity';
import { EMAIL_MS } from 'src/microservices/email/email.messages';
import { EmailTemplate } from 'src/shared/constants/enums';
import { RabbitMQPublisherService } from 'src/shared/modules/rabbitmq/rabbitmq-publisher.service';
import { TicketPdfService } from './ticket-pdf.service';

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
		@Optional() private readonly ticketPdfService: TicketPdfService | null,
		@InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
	) {}

	/**
	 * Send booking confirmation email
	 */
	async sendBookingConfirmation(booking: Booking): Promise<void> {
		this.logger.log(`Sending booking confirmation for booking ${booking.booking_id}`);

		try {
			// Reload booking with full relations to ensure we have all data needed for email
			const detailedBooking = await this.bookingRepo.findOne({
				where: { booking_id: booking.booking_id },
				relations: [
					'currency',
					'user',
					'booking_segments',
					'booking_segments.flight_instance',
					'booking_segments.flight_instance.flight_schedule',
					'booking_segments.flight_instance.flight_schedule.route',
					'booking_segments.fare_class',
					'booking_segments.flight_seat', // Load flight_seat to show seat number if selected
				],
			}) || booking;

			const emailAddress = detailedBooking.contact_email || detailedBooking.user?.email;
			if (!emailAddress) {
				this.logger.warn(
					`Cannot send booking confirmation: No email address found for booking ${booking.booking_id}`,
				);
				return;
			}

		const passengerName = detailedBooking.contact_fullname || detailedBooking.user?.fullname || 'Quý khách';

		// Format flight details from booking segments
		const flightDetails = this.formatFlightDetails(detailedBooking);

		// Calculate check-in time (2 hours before departure for domestic, 3 hours for international)
		const checkInTime = this.calculateCheckInTime(detailedBooking);

		// Send email via RabbitMQ (preferred) or TCP (fallback)
		const emailDto = {
			to: emailAddress,
			template: EmailTemplate.BOOKING_CONFIRMATION,
			templateData: {
				pnrCode: detailedBooking.pnr_code,
				bookingId: detailedBooking.booking_id,
				totalAmount: detailedBooking.total_amount,
				currency: detailedBooking.currency.currency_code,
				passengerName,
				flightDetails,
				checkInTime,
			},
		};

		// Try RabbitMQ first (preferred)
		if (this.rabbitMQPublisher) {
			try {
				await this.rabbitMQPublisher.publishEmail(emailDto);
				this.logger.log(
					`Booking confirmation queued via RabbitMQ to ${emailAddress} for booking ${detailedBooking.pnr_code}`,
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
				`Booking confirmation sent via TCP to ${emailAddress} for booking ${detailedBooking.pnr_code}`,
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
	 * Send ticket confirmation email with detailed information and PDF attachments
	 * Called after tickets are successfully created
	 * For guest users, PDF tickets are generated and attached to the email
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

			// Generate PDF tickets and get file paths
			// This is especially important for guest users who don't have accounts
			let pdfFilePaths: string[] = [];
			if (this.ticketPdfService) {
				try {
					pdfFilePaths = await this.ticketPdfService.generateAllTicketsPdf(booking, tickets);
					this.logger.log(
						`Generated ${pdfFilePaths.length} PDF tickets for booking ${booking.pnr_code}`,
					);
				} catch (error: any) {
					this.logger.error(
						`Failed to generate PDF tickets: ${error.message}. Continuing without PDF attachments.`,
					);
					// Continue without PDFs - email will still be sent
				}
			} else {
				this.logger.warn('TicketPdfService not available. PDF tickets will not be generated.');
			}

			// Send email via RabbitMQ (preferred) or TCP (fallback)
			const emailDto = {
				to: emailAddress,
				template: EmailTemplate.TICKET_CONFIRMATION,
				templateData: {
					passengerName,
					ticketDetails,
					checkInTime,
				},
				attachments: pdfFilePaths.length > 0 ? pdfFilePaths : undefined,
			};

			// Try RabbitMQ first (preferred)
			if (this.rabbitMQPublisher) {
				try {
					await this.rabbitMQPublisher.publishEmail(emailDto);
					this.logger.log(
						`Ticket confirmation queued via RabbitMQ to ${emailAddress} for booking ${booking.pnr_code} with ${tickets.length} tickets${pdfFilePaths.length > 0 ? ` and ${pdfFilePaths.length} PDF attachments` : ''}`,
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
					`Ticket confirmation sent via TCP to ${emailAddress} for booking ${booking.pnr_code} with ${tickets.length} tickets${pdfFilePaths.length > 0 ? ` and ${pdfFilePaths.length} PDF attachments` : ''}`,
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
			this.logger.warn(`No booking segments found for booking ${booking.booking_id}`);
			return [];
		}

		if (!tickets || tickets.length === 0) {
			this.logger.warn(`No tickets provided for booking ${booking.booking_id}`);
			return [];
		}

		const ticketDetails: any[] = [];

		// Log tickets status for debugging
		const ticketsWithPassenger = tickets.filter(t => t.booking_passenger).length;
		this.logger.log(`[formatTicketDetails] Processing ${booking.booking_segments.length} segments with ${tickets.length} tickets (${ticketsWithPassenger} have booking_passenger relation)`);

		// Map tickets to segments
		for (const segment of booking.booking_segments) {
			// CRITICAL: Check if segment has booking_passenger
			if (!segment.booking_passenger) {
				this.logger.warn(`Segment ${segment.booking_segment_id} does not have booking_passenger relation loaded`);
				continue;
			}

			// CRITICAL: Find ticket by matching booking_passenger_id
			// Handle case where tickets may not have booking_passenger relation loaded
			let ticket: any = null;
			
			for (const t of tickets) {
				// Check if ticket has booking_passenger relation
				if (!t || !t.booking_passenger) {
					continue; // Skip tickets without booking_passenger relation
				}
				
				// Match by booking_passenger_id
				if (t.booking_passenger.booking_passenger_id === segment.booking_passenger.booking_passenger_id) {
					ticket = t;
					break;
				}
			}

			if (!ticket) {
				this.logger.warn(
					`No ticket found for segment ${segment.booking_segment_id}, passenger ${segment.booking_passenger?.booking_passenger_id}`,
				);
				continue;
			}

			const flightInstance = segment.flight_instance;
			if (!flightInstance) {
				this.logger.warn(`No flight instance found for segment ${segment.booking_segment_id}`);
				continue;
			}

			const schedule = flightInstance.flight_schedule;
			const route = schedule?.route;
			const fareClass = segment.fare_class;

			if (!route || !route.origin_airport || !route.destination_airport) {
				this.logger.warn(`Incomplete route data for segment ${segment.booking_segment_id}`);
				continue;
			}

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

			// Get seat number - CRITICAL: Check if seat is assigned
			const seatNumber = segment.flight_seat?.seat_number || 'N/A';
			
			// Log seat information for debugging
			if (segment.flight_seat) {
				this.logger.log(
					`Segment ${segment.booking_segment_id} has seat: ${segment.flight_seat.seat_number} (${segment.flight_seat.flight_seat_id})`,
				);
			} else {
				this.logger.warn(
					`Segment ${segment.booking_segment_id} does NOT have a seat assigned. This should not happen after check-in.`,
				);
			}

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
	 * Calculate check-in time based on flight departure time
	 * Default: 24 hours before departure
	 */
	private calculateCheckInTime(booking: Booking): string {
		if (!booking.booking_segments || booking.booking_segments.length === 0) {
			return 'N/A';
		}

		// Get first segment to determine check-in time
		const firstSegment = booking.booking_segments[0];
		const flightInstance = firstSegment?.flight_instance;

		if (!flightInstance?.departure_datetime_local) {
			return 'N/A';
		}

		const departureTime = new Date(flightInstance.departure_datetime_local);

		// Calculate check-in time: 24 hours before departure (default)
		const checkInHours = 24;
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

