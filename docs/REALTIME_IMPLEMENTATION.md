# Real-time Communication Implementation

## Tổng quan

Đã implement real-time communication cho flight booking system sử dụng **WebSocket** và **Redis Pub/Sub** theo kiến trúc MicroService, tuân thủ best practices.

## Implementation Priority

### High Priority (Đã hoàn thành)

1. **Seat Availability Updates** - Tránh conflict khi nhiều user cùng chọn ghế
   - Technology: Redis Pub/Sub
   - Service: `SeatAvailabilityService`
   - Frontend Hook: `useSeatAvailability`

2. **Reservation Countdown Timer** - Business critical, sync countdown từ server
   - Technology: WebSocket + TCP (Reservation MS)
   - Service: `ReservationCountdownService`
   - Frontend Hook: `useReservationCountdown`

3. **Booking Confirmation & Payment Status** - UX quan trọng
   - Technology: Redis Pub/Sub
   - Service: `PaymentStatusService`
   - Frontend Hook: `usePaymentStatus`

### Medium Priority (Có thể implement sau)

1. Flight status updates (SSE)
2. Price changes alerts (SSE)
3. Live inventory sync (SSE)

### Low Priority (Polling đủ)

1. Multi-user booking coordination
2. Live chat support
3. Queue management
4. Notification system

## Architecture

### Backend Structure

```
be-flight-booking/src/api-gateway/modules/realtime/
├── realtime.module.ts              # Main module
├── realtime.gateway.ts             # WebSocket Gateway
├── realtime.service.ts             # Subscription management
├── services/
│   ├── seat-availability.service.ts
│   ├── reservation-countdown.service.ts
│   └── payment-status.service.ts
├── README.md                       # Usage guide
├── INTEGRATION.md                  # Integration guide
└── SETUP.md                        # Setup instructions
```

### Frontend Structure

```
booking/app/hooks/
├── use-realtime.ts                 # Base WebSocket hook
├── use-seat-availability.ts        # Seat availability hook
├── use-reservation-countdown.ts    # Countdown hook
└── use-payment-status.ts           # Payment status hook
```

## Technology Stack

- **WebSocket**: Socket.IO (NestJS WebSocket Gateway)
- **Redis Pub/Sub**: Broadcast events across instances
- **Microservices**: TCP communication với Reservation và Payment services
- **Frontend**: Socket.IO Client (React hooks)

## Key Features

### 1. Seat Availability Service

- **Real-time updates**: Khi seat được reserve/release, tất cả clients nhận update ngay lập tức
- **Redis Pub/Sub**: Scale horizontally với multiple API Gateway instances
- **Conflict prevention**: Tránh 2 users cùng chọn 1 seat

### 2. Reservation Countdown Service

- **Server-synced timer**: Server là source of truth, tránh client-side drift
- **Automatic updates**: Broadcast countdown mỗi 1 giây
- **Expiration handling**: Tự động notify khi reservation hết hạn

### 3. Payment Status Service

- **Immediate confirmation**: Payment status updates ngay khi có thay đổi
- **Webhook support**: Tích hợp với payment gateway webhooks
- **Booking & Payment level**: Subscribe theo booking hoặc payment ID

## Authentication

WebSocket connection hỗ trợ:
- **JWT Token**: Authenticated users (via `auth.token`)
- **Session ID**: Guest users (via `auth.sessionId`)

## WebSocket Events

### Client → Server

- `subscribe:seat-availability` - Subscribe to seat updates
- `unsubscribe:seat-availability` - Unsubscribe
- `subscribe:reservation-countdown` - Subscribe to countdown
- `unsubscribe:reservation-countdown` - Unsubscribe
- `subscribe:payment-status` - Subscribe to payment updates
- `unsubscribe:payment-status` - Unsubscribe

### Server → Client

- `connected` - Connection confirmed
- `seat-availability:update` - Seat availability changed
- `reservation-countdown:update` - Countdown updated (every second)
- `reservation-countdown:expired` - Reservation expired
- `payment-status:update` - Payment status changed
- `error` - Error occurred

## Redis Channels

- `seat:availability:{flightInstanceId}` - Seat availability updates
- `payment:status:booking:{bookingId}` - Payment status by booking
- `payment:status:payment:{paymentId}` - Payment status by payment

## Integration Points

### 1. Seat Availability

Publish events khi:
- Seat được reserve (trong Reservation Service)
- Seat được release (khi reservation expired/cancelled)

**Location**: `INTEGRATION.md` - Section 1

### 2. Payment Status

Publish events khi:
- Payment status thay đổi (trong Payment Service hoặc Webhook handler)

**Location**: `INTEGRATION.md` - Section 2

### 3. Reservation Countdown

Tự động chạy khi client subscribe. Không cần publish từ services.

## Best Practices

1. **Always unsubscribe** khi component unmount
2. **Handle connection errors** gracefully
3. **Use server as source of truth** cho countdown timer
4. **Publish events immediately** khi state changes
5. **Use Redis Pub/Sub** cho multi-instance deployments
6. **BE manages state** - Frontend chỉ hiển thị
7. **SOLID principles** - Mỗi service có single responsibility
8. **TypeScript** - Full type safety

## Performance Considerations

- WebSocket connections là persistent (không có polling overhead)
- Redis Pub/Sub scale horizontally
- Countdown updates mỗi 1 giây (có thể config)
- Seat updates là event-driven (chỉ khi có thay đổi)

## Next Steps

1. **Cài đặt dependencies** (xem `SETUP.md`)
2. **Integrate với existing services** (xem `INTEGRATION.md`)
3. **Test real-time updates** (xem `README.md`)
4. **Implement Medium priority features** (SSE cho flight status, price changes)

## Files Created

### Backend
- `realtime.module.ts`
- `realtime.gateway.ts`
- `realtime.service.ts`
- `services/seat-availability.service.ts`
- `services/reservation-countdown.service.ts`
- `services/payment-status.service.ts`
- `README.md`
- `INTEGRATION.md`
- `SETUP.md`

### Frontend
- `hooks/use-realtime.ts`
- `hooks/use-seat-availability.ts`
- `hooks/use-reservation-countdown.ts`
- `hooks/use-payment-status.ts`

## Dependencies Required

### Backend
```json
{
  "@nestjs/websockets": "^11.0.0",
  "socket.io": "^4.0.0"
}
```

### Frontend
```json
{
  "socket.io-client": "^4.0.0"
}
```

## Notes

- Module đã được thêm vào `app.module.ts`
- WebSocket server chạy trên namespace `/realtime`
- CORS đã được config cho frontend
- Authentication hỗ trợ cả JWT và Session ID

