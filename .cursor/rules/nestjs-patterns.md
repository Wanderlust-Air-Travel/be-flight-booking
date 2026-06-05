---
description: "NestJS patterns, modules, and microservices conventions"
globs: ["**/*.ts"]
alwaysApply: false
---

# NestJS Backend Patterns

## Module Structure

Each microservice follows this pattern:

```
microservices/
├── booking/
│   ├── booking.module.ts       # Module definition
│   ├── booking.service.ts      # Business logic
│   ├── booking.controller.ts   # Optional HTTP (rarely used)
│   ├── booking.messages.ts     # Message pattern definitions
│   ├── dto/
│   │   ├── create-booking.dto.ts
│   │   └── booking-response.dto.ts
│   ├── entities/
│   └── tests/
│       └── booking.service.spec.ts
```

## Dependency Injection

- Use constructor injection: `constructor(private readonly service: MyService) {}`
- Use `@Inject()` decorator with string or token for non-class providers
- Define interfaces for services to allow swapping implementations
- Avoid importing `ConfigModule` in every file; use `ConfigService` injected once per service

## Data Access (TypeORM)

```typescript
// Use repository pattern
constructor(
  @InjectRepository(BookingEntity)
  private readonly bookingRepo: Repository<BookingEntity>,
) {}

// Never use SELECT *; specify columns explicitly
const bookings = await this.bookingRepo.find({
  where: { userId },
  select: ['id', 'status', 'createdAt'],
  relations: ['passengers', 'segments'],
  order: { createdAt: 'DESC' },
});
```

## Microservices (TCP)

```typescript
// Controller (listener)
@Controller()
export class BookingController {
  @MessagePattern({ cmd: 'booking.create' })
  async create(@Payload() dto: CreateBookingDto): Promise<BookingResponseDto> {
    return this.bookingService.create(dto);
  }

  @EventPattern({ cmd: 'booking.seat.locked' })
  async handleSeatLocked(@Payload() data: SeatLockedEvent): Promise<void> {
    await this.bookingService.onSeatLocked(data);
  }
}
```

## Redis Caching Pattern

```typescript
// Cache with TTL
async getFlightSchedule(id: string): Promise<FlightSchedule | null> {
  const cached = await this.redis.get(`flight:schedule:${id}`);
  if (cached) return JSON.parse(cached);

  const schedule = await this.scheduleRepo.findOne({ where: { id } });
  if (schedule) {
    await this.redis.setex(`flight:schedule:${id}`, 3600, JSON.stringify(schedule));
  }
  return schedule;
}
```

## Validation

- Always use `class-validator` decorators in DTOs
- Use `ValidationPipe` globally with `whitelist: true, transform: true, forbidNonWhitelisted: true`
- Create custom validators for domain-specific rules (e.g., `IsVietnamesePhone`)
- Validate UUID v7 format using the `@IsUUIDV7()` custom decorator

## Error Handling

- Use `NotFoundException`, `BadRequestException`, `ConflictException` from `@nestjs/common`
- Create custom exception filters for consistent error response format
- Never expose stack traces or internal error details in production
- Log errors with correlation ID for tracing

## Transactions

```typescript
async createBookingWithPayment(dto: CreateBookingDto) {
  return this.dataSource.transaction(async (manager) => {
    const booking = await manager.save(BookingEntity, { ...dto });
    const payment = await manager.save(PaymentEntity, { bookingId: booking.id });
    return { booking, payment };
  });
}
```

## Logging

- Use `Logger` from `@nestjs/common` with context
- Log all incoming messages at DEBUG level
- Log all database writes at INFO level
- Log all errors at ERROR level with stack trace

## Idempotency

Payment and booking operations must be idempotent. Use idempotency keys:

```typescript
async processPayment(idempotencyKey: string, dto: PaymentDto) {
  const existing = await this.paymentRepo.findOne({ where: { idempotencyKey } });
  if (existing) return existing; // Return cached result

  const payment = await this.paymentService.charge(dto);
  await this.paymentRepo.save({ idempotencyKey, ...payment });
  return payment;
}
```
