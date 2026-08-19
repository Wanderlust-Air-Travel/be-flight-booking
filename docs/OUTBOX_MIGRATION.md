# Outbox Pattern Migration Notes (Phase 7)

## Summary

This document explains how the transactional outbox pattern replaces the
3× dual-write fallback anti-patterns identified in the original audit.

## Original Anti-Patterns

The old `booking.service.ts`, `payment.service.ts`, and
`booking-notification.service.ts` followed this sequence:

```ts
// 1. Write to database
await queryRunner.commitTransaction();

// 2. Try RabbitMQ
try {
  await this.rabbitMQPublisher.publishTicketCreation({...});
} catch (e) {
  // Anti-pattern: ASYNC setTimeout → direct TCP fallback
  setTimeout(async () => {
    await this.bookingClient.send(...);  // direct TCP call
  }, 0);
}
```

**Problem**: steps 1 and 2 are non-atomic. If RabbitMQ is up, DB commits,
message sent: ✓. If RabbitMQ is down, DB commits but message never sent
(silent failure or async TCP race).

## New Pattern (Outbox)

The new code path, used by every handler in
`microservices/{booking,payment,reservation,email}`:

```ts
// 1. Persist aggregate
await this.bookingRepo.save(booking);

// 2. Append event to OUTBOX in same DB transaction
for (const event of booking.pullDomainEvents()) {
  await this.outbox.append(event);
}
// ... transaction commits ...
// Outbox row + aggregate row commit TOGETHER — atomic.

// 3. OutboxProcessor (cron, every 5s) drains published rows
await this.processor.processBatch();
// → calls eventBus.publish(event) → RabbitMQ
```

**Guarantee**: outbox row is committed with the aggregate. If RabbitMQ is
down, the row stays unpublished; next batch retries. No silent failures.

## Files Changed

- `shared/application/ports/outbox-writer.interface.ts` — port
- `shared/infrastructure/persistence/typeorm/typeorm-outbox-writer.ts` — prod impl
- `shared/infrastructure/persistence/typeorm/typeorm-outbox-repository.ts` — repo
- `shared/infrastructure/messaging/outbox-processor.ts` — drain logic
- `shared/modules/outbox/outbox.module.ts` — NestJS module
- `shared/modules/event-bus/event-bus.module.ts` — wires bus + processor
- `shared/modules/event-bus/outbox.scheduler.ts` — cron trigger
- `migrations/1767000000000-CreateOutboxEventsTable.ts` — schema

## Old Code Retained

The original service files (`booking.service.ts`, `payment.service.ts`,
`reservation.service.ts`, `booking-notification.service.ts`) still exist
in the repo but are NOT imported by any module. They are slated for
deletion in Phase 9.

## Dual-Write Fallback Block Locations (TO BE REMOVED)

| File | Lines |
|---|---|
| payment.service.ts | 414–446 |
| payment.service.ts | 701–725 |
| booking-notification.service.ts | 100–119 |

These blocks contain `setTimeout(async () => { ... })` inside a
`catch (rabbitMqError)` block — the dual-write anti-pattern.

When Phase 9 runs, these blocks are deleted; the new handlers
(`ProcessPaymentHandler`, `CreateTicketsFromBookingHandler`,
`BookingCreatedNotificationHandler`) already use the outbox correctly.