# RabbitMQ Integration

## Tổng quan

RabbitMQ đã được tích hợp vào hệ thống để cải thiện kiến trúc microservices, cung cấp async messaging và event-driven communication.

## Kiến trúc

### Components

1. **RabbitMQ Service** (`src/shared/modules/rabbitmq/rabbitmq.service.ts`)
   - Quản lý connection và channels
   - Automatic reconnection với exponential backoff
   - Connection pooling
   - Message persistence

2. **RabbitMQ Publisher Service** (`src/shared/modules/rabbitmq/rabbitmq-publisher.service.ts`)
   - High-level methods để publish messages
   - Business-friendly API

3. **Consumers**
   - **Email Consumer** (`src/microservices/email/consumers/email-rabbitmq.consumer.ts`): Xử lý email notifications
   - **Ticket Consumer** (`src/microservices/booking/consumers/ticket-rabbitmq.consumer.ts`): Xử lý ticket creation

## Queues

### Email Notifications Queue
- **Queue Name**: `email_notifications` (configurable via `RABBITMQ_QUEUE_EMAIL`)
- **Purpose**: Async email sending
- **Consumer**: Email Microservice
- **Publisher**: All services that need to send emails

### Ticket Creation Queue
- **Queue Name**: `ticket_creation` (configurable via `RABBITMQ_QUEUE_TICKETS`)
- **Purpose**: Async ticket creation after payment
- **Consumer**: Booking Microservice
- **Publisher**: Payment Microservice

## Exchanges

### Events Exchange
- **Exchange Name**: `flight_booking_events` (configurable via `RABBITMQ_EXCHANGE_EVENTS`)
- **Type**: Topic
- **Purpose**: Pub/Sub pattern cho system events
- **Routing Keys**: 
  - `payment.success`
  - `payment.failed`
  - `booking.created`
  - `ticket.created`

## Use Cases

### 1. Async Email Notifications

**Before (TCP)**:
```
Payment Service → TCP → Email Service → Send Email (blocking)
```

**After (RabbitMQ)**:
```
Payment Service → RabbitMQ Queue → Email Service → Send Email (async)
```

**Benefits**:
- Non-blocking payment processing
- Better scalability
- Automatic retry on failure
- Message persistence

### 2. Async Ticket Creation

**Before (TCP with setTimeout)**:
```
Payment Service → setTimeout → TCP → Booking Service → Create Tickets
```

**After (RabbitMQ)**:
```
Payment Service → RabbitMQ Queue → Booking Service → Create Tickets
```

**Benefits**:
- Reliable message delivery
- Automatic retry
- Better error handling
- No blocking payment processing

## Configuration

### Environment Variables

```env
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=admin
RABBITMQ_PASS=admin123
RABBITMQ_VHOST=/
RABBITMQ_QUEUE_EMAIL=email_notifications
RABBITMQ_QUEUE_TICKETS=ticket_creation
RABBITMQ_EXCHANGE_EVENTS=flight_booking_events
RABBITMQ_PREFETCH_COUNT=10
```

### Docker Setup

RabbitMQ được cấu hình trong `docker-compose.yml`:
- Port 5672: AMQP protocol
- Port 15672: Management UI
- Health checks enabled
- Data persistence via volumes

## Best Practices

1. **Message Persistence**: Tất cả messages được đánh dấu `persistent: true`
2. **Manual Acknowledgment**: Consumers sử dụng manual ack để đảm bảo message chỉ được xóa sau khi xử lý thành công
3. **Error Handling**: Failed messages được nack và requeue
4. **Connection Management**: Automatic reconnection với exponential backoff
5. **Prefetch Count**: Giới hạn số messages được prefetch để load balancing

## Fallback Strategy

Nếu RabbitMQ không available, hệ thống sẽ fallback về TCP direct calls:
- Payment Service → Direct TCP → Booking Service (ticket creation)
- Email Service vẫn hoạt động qua TCP nếu RabbitMQ consumer không available

## Monitoring

### RabbitMQ Management UI

Truy cập: `http://localhost:15672`
- Username: `admin`
- Password: `admin123`

Có thể monitor:
- Queue lengths
- Message rates
- Consumer status
- Connection status

## Future Enhancements

1. **Dead Letter Queues**: Xử lý messages failed sau nhiều lần retry
2. **Message TTL**: Auto-expire old messages
3. **Priority Queues**: Ưu tiên xử lý critical messages
4. **Message Routing**: Advanced routing rules cho events exchange
5. **Monitoring Integration**: Tích hợp với monitoring tools (Prometheus, Grafana)

