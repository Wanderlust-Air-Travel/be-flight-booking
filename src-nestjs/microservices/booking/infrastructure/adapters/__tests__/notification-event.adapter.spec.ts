import { NotificationEventAdapter } from '../notification-event.adapter';
import type { IDomainEventBus } from '../../../../../shared/application/ports/domain-event-bus.interface';

describe('NotificationEventAdapter', () => {
    let adapter: NotificationEventAdapter;
    let bus: { publish: jest.Mock };

    beforeEach(() => {
        bus = { publish: jest.fn().mockResolvedValue(undefined) };
        adapter = new NotificationEventAdapter(bus as any);
    });

    it('sendBookingConfirmation publishes notification.booking_confirmation_requested', async () => {
        await adapter.sendBookingConfirmation({
            bookingId: 'b-1',
            pnr: 'ABC123',
            to: 'a@b.com',
            passengerName: 'Alice',
        });
        expect(bus.publish).toHaveBeenCalledTimes(1);
        const event = bus.publish.mock.calls[0][0];
        expect(event.eventName).toBe('notification.booking_confirmation_requested');
        expect(event.aggregateId).toBe('b-1');
    });

    it('sendBookingCancellation publishes notification.booking_cancellation_requested', async () => {
        await adapter.sendBookingCancellation({
            bookingId: 'b-2',
            pnr: 'XYZ789',
            to: 'a@b.com',
            refundAmount: 900,
            reason: 'plans changed',
        });
        const event = bus.publish.mock.calls[0][0];
        expect(event.eventName).toBe('notification.booking_cancellation_requested');
        expect(event.aggregateId).toBe('b-2');
    });
});