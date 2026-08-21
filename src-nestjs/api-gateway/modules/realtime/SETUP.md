# Real-time WebSocket Setup Guide

## Dependencies Installation

### Backend

```bash
cd be-flight-booking
npm install @nestjs/websockets socket.io
```

### Frontend

```bash
cd booking
npm install socket.io-client
```

## Configuration

### Backend Environment Variables

Thêm vào `.env`:

```env
FRONTEND_URL=http://localhost:3001
```

### Frontend Environment Variables

Thêm vào `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Architecture Overview

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Client    │◄───────►│  WebSocket  │◄───────►│    Redis    │
│  (Next.js)  │         │   Gateway   │         │   Pub/Sub   │
└─────────────┘         └──────────────┘         └─────────────┘
                                │
                                │ TCP
                                ▼
                        ┌──────────────┐
                        │ Microservices│
                        │ (Reservation,│
                        │   Payment)   │
                        └──────────────┘
```

## Services

### 1. Seat Availability Service
- **Purpose**: Real-time seat availability updates
- **Technology**: Redis Pub/Sub
- **Events**: `seat-availability:update`

### 2. Reservation Countdown Service
- **Purpose**: Server-synced countdown timer
- **Technology**: WebSocket + TCP (Reservation MS)
- **Events**: `reservation-countdown:update`, `reservation-countdown:expired`

### 3. Payment Status Service
- **Purpose**: Real-time payment status updates
- **Technology**: Redis Pub/Sub
- **Events**: `payment-status:update`

## Usage Examples

Xem `README.md` và `INTEGRATION.md` để biết chi tiết.

## Testing

1. Start backend:
```bash
cd be-flight-booking
npm run start:all
```

2. Start frontend:
```bash
cd booking
npm run dev
```

3. Test WebSocket connection:
- Open browser console
- Check for `[Realtime] Connected to WebSocket server` message

4. Test seat availability:
- Navigate to seat selection page
- Select a seat
- Open another browser tab
- Verify seat becomes unavailable in real-time

5. Test reservation countdown:
- Create a reservation
- Subscribe to countdown
- Verify countdown updates every second

6. Test payment status:
- Process a payment
- Verify status updates in real-time

