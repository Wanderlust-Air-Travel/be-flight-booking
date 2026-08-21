/**
 * INotificationPort — Port to the notification/email bounded context.
 *
 * Booking context sends notifications via this port. The infrastructure
 * adapter may publish an event (preferred) or call the email microservice
 * directly via TCP (fallback for backward compat).
 */
export interface INotificationPort {
    /**
     * Send a booking-related notification.
     */
    sendBookingConfirmation(input: BookingNotificationInput): Promise<void>;

    /**
     * Send a booking cancellation notification.
     */
    sendBookingCancellation(input: BookingCancellationInput): Promise<void>;
}

export interface BookingNotificationInput {
    bookingId: string;
    pnr: string;
    to: string;
    passengerName: string;
}

export interface BookingCancellationInput {
    bookingId: string;
    pnr: string;
    to: string;
    refundAmount: number;
    reason: string;
}

export const NOTIFICATION_PORT = 'INotificationPort';
