# DDD + EDA Architecture Guide

## Overview

`be-flight-booking` follows Domain-Driven Design (DDD) with Event-Driven
Architecture (EDA). Each microservice is a **bounded context** with its
own domain layer, application layer (use-case handlers), infrastructure
layer (persistence, messaging), and interface layer (NestJS controllers).

## Bounded Contexts

| Context | Purpose |
|---|---|
| **booking** | Booking lifecycle (create, pay, cancel, check-in, ticket issuance) |
| **payment** | Payment intent, gateway interaction, refunds, webhooks |
| **reservation** | Time-bound flight holds (TTL expiry, conversion to booking) |
| **email** | Outbound email queue and delivery tracking |
| **search** | Flight search, fare options, schedule details |
| **routes** | Route + flight schedule catalog |
| **services** | Promotions & deals |
| **admin** | Dashboard, audit logs, flight management |
| **auth** | Login, refresh token |
| **realtime** | WebSocket gateway for live updates |

## Layer Responsibilities

```
src-nestjs/microservices/<context>/
├── domain/                # Pure DDD — no framework, no infrastructure deps
│   ├── aggregates/        # Rich domain models with behavior
│   ├── events/            # Domain events
│   ├── repositories/      # Repository interfaces (no implementation)
│   └── value-objects/     # Value objects
├── application/           # Application orchestration
│   ├── commands/          # Command DTOs
│   ├── handlers/          # Use-case handlers (single responsibility)
│   ├── event-handlers/    # @EventPattern consumers
│   └── ports/             # Outbound port interfaces
├── infrastructure/        # Adapters to the outside world
│   ├── adapters/          # Port implementations (TCP, Gmail, etc.)
│   └── repositories/      # TypeORM / InMemory implementations
└── interface/             # NestJS-facing thin adapters
    └── *.message-handler.ts  # @MessagePattern thin wrappers
```

## Dependency Rule

Domain ← Application ← Infrastructure ← Interface

- **Domain** depends on nothing (only the shared kernel)
- **Application** depends on Domain + ports
- **Infrastructure** implements ports; depends on Application
- **Interface** depends on Application; never the other way around

## Event-Driven Communication

### Outbox Pattern (atomic publish guarantee)

Every state change goes through:

```ts
await aggregateRepo.save(aggregate);
for (const event of aggregate.pullDomainEvents()) {
  await outbox.append(event);  // same DB transaction
}
// transaction commits → outbox row + aggregate row together

// Later (cron every 5s):
await outboxProcessor.processBatch();
// → drains unpublished rows → publishes to RabbitMQ
```

### Subscribing (cross-context)

```ts
@Controller()
export class PaymentSucceededHandler {
  @EventPattern('payment.succeeded')
  async handle(payload: { bookingId: string }) {
    await this.createTicketsHandler.execute({ bookingId, ticketCount: 1 });
  }
}
```

### Cross-Context Port Adapters

```ts
// In application/ports/
export interface IReservationPort {
  findById(id: string): Promise<ReservationSummary>;
  cancel(id: string, by: string): Promise<void>;
}

// In infrastructure/adapters/
export class ReservationTcpAdapter implements IReservationPort { ... }

// Wired in module:
{ provide: 'IReservationPort', useClass: ReservationTcpAdapter }
```

This replaces `@Inject('RESERVATION_CLIENT')` string-token coupling
with a typed contract. Tests use in-memory fakes (`InMemoryReservationPort`).

## Shared Kernel

`src-nestjs/shared/` provides cross-cutting types and infrastructure:

- `domain/base/AggregateRoot<TId>` — base for all aggregates
- `domain/base/ValueObject<T>` — base for all value objects
- `domain/events/IDomainEvent` — marker interface for events
- `application/ports/IDomainEventBus`, `IOutboxWriter`
- `infrastructure/messaging/RabbitMQEventBus`, `OutboxProcessor`
- `infrastructure/persistence/typeorm/TypeOrmOutboxWriter`
- `modules/outbox/outbox.module.ts` — global @Global module

## Adding a New Bounded Context

1. Create `src-nestjs/microservices/<name>/{domain,application,infrastructure,interface}`.
2. Define aggregate(s) with rich behavior (not getters/setters).
3. Define value objects with invariants.
4. Define domain events emitted on state changes.
5. Define `I<X>Repository` interface + `InMemory<X>Repository` for tests.
6. Write use-case handlers (one per use case). Inject ports via `I<X>Port`.
7. Write `@MessagePattern` thin handlers in interface layer.
8. Wire everything in `<name>.module.ts`. Import `OutboxModule`.
9. Add `@EventPattern` handlers for events from other contexts.
10. Write tests FIRST (Red-Green-Refactor).

## Anti-Patterns Replaced

| Anti-Pattern | Replacement |
|---|---|
| God service (`booking.service.ts` 3966 lines) | 9 single-purpose handlers |
| Anemic entities (just columns) | Rich aggregates with behavior |
| `@InjectRepository` in application layer | Domain repositories interfaces + Infrastructure adapters |
| `@Inject('*_CLIENT')` string-token coupling | Typed port interfaces + adapter implementations |
| `setTimeout(...) → direct TCP` fallback | Transactional outbox pattern |
| Cross-context repository leak (`payment` injecting Booking) | `IBookingPort` cross-context read port |
| Dual-write (DB + RabbitMQ non-atomic) | Outbox table + OutboxProcessor cron |
| Raw `amqplib` consumer | NestJS `@EventPattern` listener |

## Testing Strategy

- **Domain layer**: pure unit tests, no framework
- **Application layer**: handler tests with in-memory repositories/ports
- **Infrastructure layer**: integration tests with TypeORM (optional)
- **E2E**: supertest for full HTTP flow
- **Coverage target**: 85%+ for application + domain

## Migration from Old Code

Old `.service.ts` files (`booking.service.ts`, `payment.service.ts`,
etc.) still exist in the repo but are NOT imported by any module. They
will be deleted in Phase 9 once all tests pass without them.