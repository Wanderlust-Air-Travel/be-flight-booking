import type { IDomainEventBus } from '../../../application/ports/domain-event-bus.interface';
import type { IDomainEvent } from '../../../domain/events/domain-event';
import { RabbitMQEventBus } from '../rabbitmq-event-bus';

class FakeEvent implements IDomainEvent {
    constructor(
        public readonly eventId: string,
        public readonly aggregateId: string,
        public readonly occurredAt: Date,
        public readonly eventName: string,
        public readonly version: number
    ) {}
}

interface PublisherLike {
    publishEvent: jest.Mock;
}

describe('RabbitMQEventBus', () => {
    let publisher: PublisherLike;
    let bus: RabbitMQEventBus;

    beforeEach(() => {
        publisher = {
            publishEvent: jest.fn(),
        };
        // Construct with minimal shape — no real RabbitMQPublisherService
        bus = new RabbitMQEventBus(publisher as any);
    });

    it('publish() calls publisher.publishEvent() with event.eventName() as routing key', async () => {
        publisher.publishEvent.mockResolvedValue(true);
        const event = new FakeEvent('evt-1', 'agg-1', new Date(), 'booking.created', 1);
        await bus.publish(event);
        expect(publisher.publishEvent).toHaveBeenCalledWith('booking.created', event, {
            correlationId: undefined,
        });
    });

    it('publish() forwards correlationId option when present', async () => {
        publisher.publishEvent.mockResolvedValue(true);
        const event = new FakeEvent('evt-1', 'agg-1', new Date(), 'booking.created', 1);
        await bus.publish(event, { correlationId: 'corr-123' });
        expect(publisher.publishEvent).toHaveBeenCalledWith('booking.created', event, {
            correlationId: 'corr-123',
        });
    });

    it('publishAll() publishes all events in order', async () => {
        publisher.publishEvent.mockResolvedValue(true);
        const events = [
            new FakeEvent('evt-1', 'agg-1', new Date(), 'a.created', 1),
            new FakeEvent('evt-2', 'agg-1', new Date(), 'a.updated', 1),
            new FakeEvent('evt-3', 'agg-1', new Date(), 'a.deleted', 1),
        ];
        await bus.publishAll(events);
        expect(publisher.publishEvent).toHaveBeenCalledTimes(3);
        expect(publisher.publishEvent.mock.calls[0][0]).toBe('a.created');
        expect(publisher.publishEvent.mock.calls[1][0]).toBe('a.updated');
        expect(publisher.publishEvent.mock.calls[2][0]).toBe('a.deleted');
    });

    it('publishAll() stops on first failure (no silent swallow)', async () => {
        publisher.publishEvent
            .mockResolvedValueOnce(true)
            .mockRejectedValueOnce(new Error('RabbitMQ down'));
        const events = [
            new FakeEvent('evt-1', 'agg-1', new Date(), 'a.created', 1),
            new FakeEvent('evt-2', 'agg-1', new Date(), 'a.updated', 1),
        ];
        await expect(bus.publishAll(events)).rejects.toThrow('RabbitMQ down');
        expect(publisher.publishEvent).toHaveBeenCalledTimes(2);
    });

    it('publish() propagates publisher errors', async () => {
        publisher.publishEvent.mockRejectedValue(new Error('connection lost'));
        const event = new FakeEvent('evt-1', 'agg-1', new Date(), 'x.y', 1);
        await expect(bus.publish(event)).rejects.toThrow('connection lost');
    });

    it('implements IDomainEventBus contract', () => {
        // Compile-time + structural check
        const busAsInterface: IDomainEventBus = bus;
        expect(busAsInterface.publish).toBeDefined();
        expect(busAsInterface.publishAll).toBeDefined();
    });
});
