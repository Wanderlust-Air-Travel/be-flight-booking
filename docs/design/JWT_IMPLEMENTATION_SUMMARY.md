# JWT Authentication Implementation Summary

## Pattern: Option 2 - Extract userId từ Gateway (IMPLEMENTED)

## Architecture

```
Client → API Gateway (Validate JWT, Extract userId) → Microservices (Receive userId, NOT token)
```

## Implementation

### 1. API Gateway - JWT Validation & Extraction

**Location:** `src/api-gateway/modules/auth/strategies/jwt.strategyt.ts`

```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    async validate(payload: TokenPayload) {
        return { userId: payload.sub, email: payload.email };
    }
}
```

**Key Points:**
- JWT validated once at Gateway level
- `userId` extracted from JWT payload (`payload.sub`)
- Stored in `req.user` for controllers

### 2. API Gateway Controllers - Extract & Forward userId

**Location:** `src/api-gateway/modules/booking/booking.controller.ts`

```typescript
@UseGuards(JwtAuthGuard)
async createBooking(@Req() req: Request & { user: { userId: string } }) {
    const userId = req.user.userId;
    this.client.send('CREATE_BOOKING', { userId, dto });
}
```

### 3. Microservices - Receive userId (NOT token)

**Location:** `src/microservices/booking/booking.controller.ts`

```typescript
@MessagePattern('CREATE_BOOKING_FROM_RESERVATION')
async handleCreateBookingFromReservation(payload: {
    userId: string; // userId (extracted by Gateway), NOT token
    dto: CreateBookingFromReservationDto;
}) {
    return await this.bookingService.createBookingFromReservation(
        payload.userId,
        payload.dto,
    );
}
```

## Key Principles

1. **Single Point of Authentication** - JWT validated only at Gateway
2. **No Token Forwarding** - Gateway never forwards JWT token
3. **Performance** - JWT validated once (Gateway), not N times (N microservices)
4. **Security** - JWT secret only at Gateway
5. **Simplicity** - Microservices don't need JWT logic

## Code Locations

**API Gateway:**
- JWT Strategy: `src/api-gateway/modules/auth/strategies/jwt.strategyt.ts`
- JWT Guard: `src/api-gateway/modules/auth/guard/jwt-auth.guard.ts`
- Controllers: `src/api-gateway/modules/*/`

**Microservices:**
- Controllers: `src/microservices/*/`
