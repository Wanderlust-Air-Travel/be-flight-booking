# Real-time Integration Guide

Hướng dẫn tích hợp real-time events vào các services hiện có.

## 1. Seat Availability Integration

### Trong Reservation Service

Khi seat được reserve hoặc release, publish event:

```typescript
// be-flight-booking/src/microservices/reservation/reservation.service.ts

import { SeatAvailabilityService } from 'src/api-gateway/modules/realtime/services/seat-availability.service';

// Inject vào constructor (cần forwardRef vì Reservation là microservice)
constructor(
  // ... existing dependencies
  @Inject(forwardRef(() => SeatAvailabilityService))
  private readonly seatAvailabilityService: SeatAvailabilityService,
) {}

// Khi reserve seat (trong createReservation)
await this.seatAvailabilityService.publishSeatChange(segmentDto.flightInstanceId, [
  {
    flightSeatId: flightSeat.flight_seat_id,
    seatNumber: flightSeat.seat_number,
    status: 'reserved',
    changedBy: userId || sessionId,
  },
]);

// Khi release seat (trong cancelReservation hoặc cleanupExpiredReservations)
await this.seatAvailabilityService.publishSeatChange(segment.flightInstanceId, [
  {
    flightSeatId: segment.flightSeatId,
    seatNumber: segment.seatNumber,
    status: 'available',
  },
]);
```

**Lưu ý**: Vì Reservation Service là microservice (TCP), không thể inject trực tiếp. Có 2 cách:

### Option 1: Publish qua RabbitMQ (Recommended)

Tạo RabbitMQ message khi seat thay đổi, API Gateway subscribe và publish WebSocket event.

### Option 2: Publish từ API Gateway Controller

Trong Reservation Controller (API Gateway), sau khi gọi microservice, publish event:

```typescript
// be-flight-booking/src/api-gateway/modules/reservation/reservation.controller.ts

constructor(
  @Inject('RESERVATION_CLIENT') private readonly client: ClientProxy,
  private readonly seatAvailabilityService: SeatAvailabilityService,
) {}

async createReservation(...) {
  const reservation = await firstValueFrom(...);
  
  // Publish seat availability changes
  for (const segment of reservation.segments) {
    await this.seatAvailabilityService.publishSeatChange(
      segment.flightInstanceId,
      [{
        flightSeatId: segment.flightSeatId,
        seatNumber: segment.seatNumber,
        status: 'reserved',
        changedBy: userId || sessionId,
      }]
    );
  }
  
  return reservation;
}
```

## 2. Payment Status Integration

### Trong Payment Service (Microservice)

Payment Service không thể inject trực tiếp. Publish từ API Gateway Controller:

```typescript
// be-flight-booking/src/api-gateway/modules/payment/payment.controller.ts

constructor(
  @Inject('PAYMENT_CLIENT') private readonly client: ClientProxy,
  private readonly paymentStatusService: PaymentStatusService,
) {}

async processPayment(...) {
  const payment = await firstValueFrom(...);
  
  // Publish payment status change
  if (payment.status === 'success' || payment.status === 'failed') {
    await this.paymentStatusService.publishPaymentStatusChange(
      payment.bookingId,
      payment.paymentId,
      payment.status,
      { transactionRef: payment.transactionRef }
    );
  }
  
  return payment;
}

// Hoặc trong webhook handler
async handleWebhook(...) {
  const result = await this.paymentService.handleWebhook(...);
  
  // Publish payment status change
  await this.paymentStatusService.publishPaymentStatusChange(
    result.bookingId,
    result.paymentId,
    result.status,
    { transactionRef: result.transactionRef }
  );
}
```

## 3. Reservation Countdown

Countdown tự động chạy khi client subscribe. Không cần publish events từ services.

## 4. RabbitMQ Integration (Future)

Để scale tốt hơn, có thể dùng RabbitMQ:

1. Microservices publish events vào RabbitMQ
2. API Gateway subscribe và broadcast qua WebSocket
3. Support multiple API Gateway instances

## Dependencies

### Backend

Cần cài đặt:
```bash
cd be-flight-booking
npm install @nestjs/websockets socket.io
```

### Frontend

Cần cài đặt:
```bash
cd booking
npm install socket.io-client
```

## Environment Variables

### Backend

```env
FRONTEND_URL=http://localhost:3001  # For CORS
```

### Frontend

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Testing

1. Start backend services
2. Connect WebSocket client
3. Subscribe to events
4. Trigger actions (reserve seat, process payment)
5. Verify real-time updates

