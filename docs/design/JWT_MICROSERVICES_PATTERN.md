# JWT Authentication Pattern in Microservices - Best Practice

## Câu hỏi

Khi Client gửi request với JWT token đến API Gateway, Gateway nên:
1. Forward JWT token đến các microservices?
2. Extract userId và gửi userId đến các microservices?
3. Cả 2 (gửi cả token và userId)?

## Best Practice: Option 2 - Extract userId từ Gateway

**Lý do:**
1. **API Gateway Pattern** - Single point of authentication
2. **Security** - JWT secret chỉ ở Gateway
3. **Performance** - Validate token một lần (Gateway) thay vì N lần (N microservices)
4. **Simplicity** - Microservices đơn giản hơn
5. **Scalability** - Dễ thay đổi auth mechanism

## Implementation

### API Gateway - Extract userId từ JWT

```typescript
// src/api-gateway/modules/auth/strategies/jwt.strategyt.ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    async validate(payload: TokenPayload) {
        return { userId: payload.sub, email: payload.email };
    }
}

// src/api-gateway/modules/booking/booking.controller.ts
@UseGuards(JwtAuthGuard)
async createBooking(@Req() req: Request & { user: { userId: string } }) {
    const userId = req.user.userId;
    this.client.send('CREATE_BOOKING', { userId, dto });
}
```

### Microservice - Nhận userId trực tiếp

```typescript
// src/microservices/booking/booking.controller.ts
@MessagePattern('CREATE_BOOKING')
async handleCreateBooking(payload: {
    userId: string; // Receive userId directly
    dto: CreateBookingFromReservationDto;
}) {
    return await this.bookingService.createBooking(payload.userId, payload.dto);
}
```

## Security Considerations

**Trust Boundary:**
- External → Gateway: JWT validation (authentication)
- Gateway → Microservices: userId (trusted, internal network)
- Microservices: Business logic authorization

**When to Forward Token?**
- Chỉ khi microservice cần fine-grained authorization (roles, permissions)
- Chỉ khi microservice là external service (không trust Gateway)

**Trong trường hợp này:** Không cần forward token vì microservices chỉ cần userId, authorization đơn giản, internal network.

## Industry Standards

- Netflix (Zuul Gateway): Gateway validates token, forward userId/claims
- Amazon API Gateway: Gateway validates token, forward claims
- Kong API Gateway: Gateway validates token, forward headers (X-User-Id)
- Google Cloud Endpoints: Gateway validates token, forward user info

## Conclusion

**Best Practice: Extract userId từ Gateway, gửi userId đến Microservices**
