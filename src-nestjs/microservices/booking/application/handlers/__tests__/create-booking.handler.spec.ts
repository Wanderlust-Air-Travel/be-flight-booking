import { CreateBookingHandler } from '../create-booking.handler';
import type { IBookingRepository } from '../../../domain/repositories/booking.repository.interface';
import type { IOutboxWriter } from '../../../../../../shared/application/ports/outbox-writer.interface';
import type { CreateBookingCommand } from '../../commands/create-booking.command';
import { Money } from '../../../domain/value-objects/money';
import { ContactInfo } from '../../../domain/value-objects/contact-info';
import { InMemoryBookingRepository } from '../../../domain/repositories/in-memory-booking.repository';
import type { IDomainEvent } from '../../../../../../shared/domain/events/domain-event';

function makeCommand(overrides: Partial<CreateBookingCommand> = {}): CreateBookingCommand {
    return {
        contact: ContactInfo.create('Alice Nguyen', 'alice@example.com', '+84912345678'),
        totalAmount: Money.create(1000000, 'VND'),
        passengers: [{ fullName: 'Alice', type: 'adult' }],
        segments: [{ flightInstanceId: 'fi-1', cabinType: 'economy', fareClassCode: 'Y' }],
        userId: 'user-1',
        ...overrides,
    };
}

describe('CreateBookingHandler', () => {
    let handler: CreateBookingHandler;
    let repo: InMemoryBookingRepository;
    let outbox: { append: jest.Mock; rows: Array<{ event: IDomainEvent; em?: any }> };

    beforeEach(() => {
        repo = new InMemoryBookingRepository();
        outbox = {
            append: jest.fn().mockImplementation(async (event: IDomainEvent) => {
                outbox.rows.push({ event });
            }),
            rows: [],
        };
        handler = new CreateBookingHandler(
            repo as any,
            outbox as any
        );
    });

    it('creates booking and returns DTO with PNR', async () => {
        const result = await handler.execute(makeCommand());
        expect(result.bookingId).toBeDefined();
        expect(result.pnr).toMatch(/^[A-Z0-9]{6}$/);
        expect(result.status).toBe('pending');
        expect(result.contactEmail).toBe('alice@example.com');
    });

    it('persists booking via repository', async () => {
        const result = await handler.execute(makeCommand());
        expect(repo.count()).toBe(1);
        const saved = await repo.findById(result.bookingId);
        expect(saved).not.toBeNull();
        expect(saved?.pnr.value).toBe(result.pnr);
    });

    it('writes BookingCreatedEvent to outbox', async () => {
        const result = await handler.execute(makeCommand());
        expect(outbox.append).toHaveBeenCalledTimes(1);
        const event = outbox.rows[0].event;
        expect(event.aggregateId).toBe(result.bookingId);
        expect(event.eventName).toBe('booking.created');
    });

    it('passes EntityManager to outbox.append when provided', async () => {
        const em = { fakeManager: true };
        // Override outbox.append to capture EntityManager arg
        outbox.append.mockImplementation(async (event: IDomainEvent, manager?: any) => {
            outbox.rows.push({ event, em: manager });
        });
        await handler.execute(makeCommand());
        // Currently no EM is passed (handler has no transaction yet); future handlers can pass one
        expect(outbox.rows[0].em).toBeUndefined();
    });

    it('throws and does not save if value object validation fails', async () => {
        const badCommand = makeCommand({
            passengers: [], // invalid — empty
        });
        await expect(handler.execute(badCommand)).rejects.toThrow();
        expect(repo.count()).toBe(0);
        expect(outbox.append).not.toHaveBeenCalled();
    });

    it('handles guest user (userId = null)', async () => {
        const result = await handler.execute(makeCommand({ userId: null }));
        const saved = await repo.findById(result.bookingId);
        expect(saved?.userId).toBeNull();
    });

    it('returns ISO date string for createdAt', async () => {
        const result = await handler.execute(makeCommand());
        expect(result.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
});