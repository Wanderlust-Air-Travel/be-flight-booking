# Real-time WebSocket Module

Module này cung cấp real-time communication cho flight booking system sử dụng WebSocket và Redis Pub/Sub.

## Architecture

### High Priority Features (WebSocket)

1. **Seat Availability Updates** - Tránh conflict khi nhiều user cùng chọn ghế
2. **Reservation Countdown Timer** - Sync countdown từ server (business critical)
3. **Payment Status Updates** - Real-time payment confirmation (UX critical)

### Medium Priority Features (SSE - có thể implement sau)

1. Flight status updates
2. Price changes alerts
3. Live inventory sync

## Technology Stack

- **WebSocket**: Socket.IO (NestJS WebSocket Gateway)
- **Redis Pub/Sub**: Broadcast events across instances
- **Microservices**: TCP communication với Reservation và Payment services

## Setup

### Backend

Module đã được thêm vào `app.module.ts`. WebSocket server chạy trên namespace `/realtime`.

### Frontend

1. Cài đặt dependencies:
```bash
cd booking
npm install socket.io-client
```

2. Sử dụng hooks:
```typescript
import { useSeatAvailability } from '@/app/hooks/use-seat-availability';
import { useReservationCountdown } from '@/app/hooks/use-reservation-countdown';
import { usePaymentStatus } from '@/app/hooks/use-payment-status';
```

## Integration với Existing Services

### 1. Seat Availability - Publish Events

Khi seat được select/reserve, gọi `publishSeatChange`:

```typescript
// Trong Reservation Service hoặc Booking State Service
import { SeatAvailabilityService } from 'src/api-gateway/modules/realtime/services/seat-availability.service';

// Khi seat được reserve
await seatAvailabilityService.publishSeatChange(flightInstanceId, [
  {
    flightSeatId: seat.flight_seat_id,
    seatNumber: seat.seat_number,
    status: 'reserved',
    changedBy: userId || sessionId,
  },
]);
```

### 2. Payment Status - Publish Events

Khi payment status thay đổi, gọi `publishPaymentStatusChange`:

```typescript
// Trong Payment Service
import { PaymentStatusService } from 'src/api-gateway/modules/realtime/services/payment-status.service';

// Khi payment thành công
await paymentStatusService.publishPaymentStatusChange(
  bookingId,
  paymentId,
  'success',
  { transactionRef: '...' }
);
```

### 3. Reservation Countdown

Countdown tự động chạy khi client subscribe. Không cần publish events.

## Frontend Usage Examples

### Seat Availability

```typescript
function SeatMapPage() {
  const flightInstanceId = searchParams.get('flightInstanceId');
  const { seatChanges, applySeatChanges, isSubscribed } = useSeatAvailability(flightInstanceId);
  
  // Apply real-time changes to seat map
  const updatedSeats = applySeatChanges(seats);
  
  return (
    <div>
      {isSubscribed && <p>Real-time updates active</p>}
      {/* Render seat map with updatedSeats */}
    </div>
  );
}
```

### Reservation Countdown

```typescript
function ReservationPage() {
  const reservationId = '...';
  const { formattedCountdown, isExpired, remainingSeconds } = useReservationCountdown(reservationId);
  
  return (
    <div>
      <p>Time remaining: {formattedCountdown}</p>
      {isExpired && <p>Reservation expired!</p>}
    </div>
  );
}
```

### Payment Status

```typescript
function PaymentPage() {
  const bookingId = '...';
  const { status, isSuccess, isFailed } = usePaymentStatus(bookingId);
  
  return (
    <div>
      {isSuccess && <p>Payment successful!</p>}
      {isFailed && <p>Payment failed</p>}
      {status === 'pending' && <p>Processing payment...</p>}
    </div>
  );
}
```

## WebSocket Events

### Client → Server

- `subscribe:seat-availability` - Subscribe to seat updates
- `unsubscribe:seat-availability` - Unsubscribe from seat updates
- `subscribe:reservation-countdown` - Subscribe to countdown
- `unsubscribe:reservation-countdown` - Unsubscribe from countdown
- `subscribe:payment-status` - Subscribe to payment updates
- `unsubscribe:payment-status` - Unsubscribe from payment updates

### Server → Client

- `connected` - Connection confirmed
- `seat-availability:update` - Seat availability changed
- `reservation-countdown:update` - Countdown updated (every second)
- `reservation-countdown:expired` - Reservation expired
- `payment-status:update` - Payment status changed
- `error` - Error occurred

## Authentication

WebSocket connection supports:
- **JWT Token**: Authenticated users (via `auth.token`)
- **Session ID**: Guest users (via `auth.sessionId`)

## Redis Channels

- `seat:availability:{flightInstanceId}` - Seat availability updates
- `payment:status:booking:{bookingId}` - Payment status by booking
- `payment:status:payment:{paymentId}` - Payment status by payment

## Best Practices

1. **Always unsubscribe** when component unmounts
2. **Handle connection errors** gracefully
3. **Use server as source of truth** for countdown timer
4. **Publish events immediately** when state changes
5. **Use Redis Pub/Sub** for multi-instance deployments

## Performance Considerations

- WebSocket connections are persistent (no polling overhead)
- Redis Pub/Sub scales horizontally
- Countdown updates every 1 second (configurable)
- Seat updates are event-driven (only when changes occur)

