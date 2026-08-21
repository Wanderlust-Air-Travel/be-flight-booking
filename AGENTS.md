# Flight Booking — Backend

NestJS 11 microservices backend API.

## Tech Stack

- **Framework:** NestJS 11 with TypeScript
- **Database:** SQL Server (TypeORM), Redis (caching, pub/sub), RabbitMQ (async messaging)
- **Auth:** JWT via Passport, bcrypt for passwords
- **Validation:** class-validator decorators on DTOs, ValidationPipe globally
- **Docs:** Swagger via @nestjs/swagger
- **Microservices:** TCP transport; controllers use `@MessagePattern` / `@EventPattern`

## Architecture

- `api-gateway/` — Entry point, HTTP + TCP transport
- `microservices/` — booking, search, routes, reservation, payment, email
- `src/shared/` — Common config, decorators, DTOs, entities

## Key Conventions

- Never SELECT *; always specify column names.
- Payment/booking operations must be idempotent (idempotency keys).
- Redis cache TTL: 3600s for flight schedules, 300s for search results.
- All database writes logged at INFO level with correlation ID.
- UUID v7 for all entity IDs.

## Agents

- Use **planner** for new feature planning.
- Use **database-reviewer** for any query or schema changes.
- Use **code-reviewer** after writing new services or controllers.
- Use **tdd-guide** before implementing business logic.
- Use **security-reviewer** before any auth/payment-related changes.