import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { EMAIL_MS } from 'src/microservices/email/email.messages';
import { EmailTemplate } from 'src/shared/constants/enums';
import { Booking } from 'src/shared/entities/booking/booking.entity';
import type { Payment } from 'src/shared/entities/payment/payment.entity';
import { RabbitMQPublisherService } from 'src/shared/modules/rabbitmq/rabbitmq-publisher.service';
import type { Repository } from 'typeorm';

/**
 * Payment Notification Service
 * Handles sending notifications for payment events via Email Microservice
 * Uses RabbitMQ (preferred) or TCP (fallback) for async email sending
 */
@Injectable()
export class PaymentNotificationService {
    private readonly logger = new Logger(PaymentNotificationService.name);

    constructor(
        @Optional() private readonly _rabbitMqPublisher: RabbitMQPublisherService | null,
        @Optional() @Inject('EMAIL_CLIENT') private readonly _emailClient: ClientProxy | null,
        @InjectRepository(Booking) private readonly _bookingRepo: Repository<Booking>
    ) {}

    private get rabbitMQPublisher(): RabbitMQPublisherService | null {
        return this._rabbitMqPublisher;
    }

    private get emailClient(): ClientProxy | null {
        return this._emailClient;
    }

    private get bookingRepo(): Repository<Booking> {
        return this._bookingRepo;
    }

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
                    `Cannot send payment success notification: No email address found for booking ${booking.booking_id}`
                );
                return;
            }

            const passengerName =
                detailedBooking.contact_fullname || detailedBooking.user?.fullname || 'Quý khách';

            // Build cabin & seat details per segment/passenger
            const seatDetails = this.formatSeatDetails(detailedBooking);

            // Calculate check-in time (2 hours before departure for domestic, 3 hours for international)
            const checkInTime = this.calculateCheckInTime(detailedBooking);

            // Send email via RabbitMQ (preferred) or TCP (fallback)
            const emailDto = {
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
                    checkInTime,
                },
            };

            // Try RabbitMQ first (preferred)
            if (this.rabbitMQPublisher) {
                try {
                    await this.rabbitMQPublisher.publishEmail(emailDto);
                    this.logger.log(
                        `Payment success notification queued via RabbitMQ to ${emailAddress} for booking ${booking.pnr_code}`
                    );
                    return;
                } catch (error: any) {
                    this.logger.warn(
                        `RabbitMQ email publishing failed, falling back to TCP: ${error.message}`
                    );
                }
            }

            // Fallback to TCP
            if (this.emailClient) {
                await firstValueFrom(this.emailClient.send(EMAIL_MS.PATTERN.SEND_EMAIL, emailDto));
                this.logger.log(
                    `Payment success notification sent via TCP to ${emailAddress} for booking ${booking.pnr_code}`
                );
            } else {
                this.logger.error('No email client available (neither RabbitMQ nor TCP)');
            }
        } catch (error: any) {
            // Log error but don't throw - notification failure shouldn't break payment flow
            this.logger.error(
                `Failed to send payment success notification: ${error.message}`,
                error.stack
            );
        }
    }

    /**
     * Send payment failed notification
     */
    async sendPaymentFailedNotification(
        payment: Payment,
        booking: Booking,
        reason?: string
    ): Promise<void> {
        this.logger.log(`Sending payment failed notification for payment ${payment.payment_id}`);

        try {
            const emailAddress = booking.contact_email || booking.user?.email;
            if (!emailAddress) {
                this.logger.warn(
                    `Cannot send payment failed notification: No email address found for booking ${booking.booking_id}`
                );
                return;
            }

            // Send email via RabbitMQ (preferred) or TCP (fallback)
            const emailDto = {
                to: emailAddress,
                template: EmailTemplate.PAYMENT_FAILED,
                templateData: {
                    bookingId: booking.booking_id,
                    pnrCode: booking.pnr_code,
                    amount: payment.amount,
                    paymentMethod: payment.payment_method.name,
                    reason: reason || 'Payment processing failed',
                },
            };

            // Try RabbitMQ first (preferred)
            if (this.rabbitMQPublisher) {
                try {
                    await this.rabbitMQPublisher.publishEmail(emailDto);
                    this.logger.log(
                        `Payment failed notification queued via RabbitMQ to ${emailAddress} for booking ${booking.pnr_code}. Reason: ${reason || 'Unknown'}`
                    );
                    return;
                } catch (error: any) {
                    this.logger.warn(
                        `RabbitMQ email publishing failed, falling back to TCP: ${error.message}`
                    );
                }
            }

            // Fallback to TCP
            if (this.emailClient) {
                await firstValueFrom(this.emailClient.send(EMAIL_MS.PATTERN.SEND_EMAIL, emailDto));
                this.logger.log(
                    `Payment failed notification sent via TCP to ${emailAddress} for booking ${booking.pnr_code}. Reason: ${reason || 'Unknown'}`
                );
            } else {
                this.logger.error('No email client available (neither RabbitMQ nor TCP)');
            }
        } catch (error: any) {
            // Log error but don't throw - notification failure shouldn't break payment flow
            this.logger.error(
                `Failed to send payment failed notification: ${error.message}`,
                error.stack
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
                'N/A';

            const cabinClass =
                segment.flight_seat?.seat_config?.cabin_class?.name ||
                segment.flight_seat?.seat_config?.cabin_class?.cabin_class_code ||
                segment.fare_class?.description ||
                segment.fare_class?.fare_class_code ||
                'N/A';

            const flightInstance = segment.flight_instance;
            const schedule = flightInstance?.flight_schedule;
            const route = schedule?.route;
            const flightNumber = schedule?.flight_number || flightInstance?.flight_number || 'N/A';

            const origin = route?.origin_airport?.iata_code || route?.origin_airport?.name || 'N/A';
            const destination =
                route?.destination_airport?.iata_code || route?.destination_airport?.name || 'N/A';

            const departureTime = flightInstance?.departure_datetime_local
                ? new Date(flightInstance.departure_datetime_local).toLocaleString('vi-VN', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                  })
                : 'N/A';

            // Check if seat is assigned (before check-in, seat will be null/N/A)
            const seatInfo =
                seatNumber === 'N/A' || !seatNumber
                    ? 'Sẽ được chọn khi làm thủ tục check-in'
                    : seatNumber;

            lines.push(
                `Chuyến bay: ${flightNumber}\n` +
                    `Từ: ${origin} → Đến: ${destination}\n` +
                    `Giờ khởi hành: ${departureTime}\n` +
                    `Hành khách: ${passengerName}\n` +
                    `Hạng vé: ${cabinClass}\n` +
                    `Số ghế: ${seatInfo}`
            );
        }

        return lines.length > 0 ? lines.join('\n\n') : 'N/A';
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
     * Send payment pending notification
     * Optional: Can be used to notify user about pending payment with payment URL
     */
    async sendPaymentPendingNotification(payment: Payment, booking: Booking): Promise<void> {
        this.logger.log(`Sending payment pending notification for payment ${payment.payment_id}`);

        // Note: Payment pending notification is optional - we don't send email for pending payments
        // Users can see pending payment status in their booking details
        // This method is kept for future use or custom implementations

        this.logger.log(
            `Payment pending notification logged for booking ${booking.pnr_code} (email notification skipped)`
        );
    }
}
