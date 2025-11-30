# Phân Tích Kiến Trúc & Quản Lý State - Flight Booking Backend

**Ngày tạo:** 2025-01-XX  
**Mục đích:** Rà soát toàn bộ dự án về quản lý state và best practices theo chuẩn Microservice & NestJS Enterprise

---

## TÓM TẮT ĐIỂM MẠNH

### Điểm Tốt Hiện Tại

1. **State Management ở Backend (TỐT)**
   - Tất cả state được quản lý ở backend (reservations, bookings, payments)
   - Không có localStorage/sessionStorage trong backend code
   - JWT tokens được lưu trong database (refresh tokens)
   - User sessions được quản lý qua JWT

2. **Database Transactions (TỐT)**
   - Sử dụng transactions cho các operations quan trọng (booking, payment)
   - Pessimistic locking cho concurrency control
   - Rollback mechanism được implement đúng

3. **Validation (TỐT)**
   - DTO validation với class-validator
   - Global ValidationPipe được cấu hình
   - Business logic validation trong services

4. **Microservice Architecture (TỐT)**
   - Tách biệt rõ ràng các microservices
   - API Gateway pattern được áp dụng
   - Message-based communication giữa services

5. **Hybrid Caching Strategy (TỐT)**
   - Redis cho caching reservations
   - Database là source of truth
   - Fallback mechanism từ Redis → Database

---

## CÁC VẤN ĐỀ TÌM THẤY VÀ ĐỀ XUẤT

### 1. THIẾU: Global Exception Handler

**Vấn đề:**
- Chỉ có `ValidationExceptionFilter` cho `BadRequestException`
- Không có global exception handler cho tất cả exceptions
- Lỗi không được format nhất quán
- Không có error tracking/logging tập trung

**Tác động:**
- Khó debug khi có lỗi
- Response format không nhất quán
- Không track được errors trong production

**Giải pháp:**
```typescript
// src/api-gateway/common/filters/http-exception.filter.ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    
    const message = exception instanceof HttpException
      ? exception.getResponse()
      : 'Internal server error';
    
    // Log error với context
    this.logger.error({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      stack: exception instanceof Error ? exception.stack : undefined,
    });
    
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: typeof message === 'string' ? message : (message as any).message,
    });
  }
}
```

---

### 2. THIẾU: Centralized Logging Service

**Vấn đề:**
- Sử dụng `console.log` và `Logger` rải rác
- Không có structured logging
- Không có log aggregation
- Không có correlation ID cho request tracing

**Tác động:**
- Khó trace request qua multiple microservices
- Khó debug distributed issues
- Không có visibility vào system behavior

**Giải pháp:**
```typescript
// src/shared/services/logging.service.ts
@Injectable()
export class LoggingService {
  private readonly logger = new Logger();
  
  log(context: string, message: string, meta?: any) {
    this.logger.log({
      context,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    });
  }
  
  error(context: string, message: string, error?: Error, meta?: any) {
    this.logger.error({
      context,
      message,
      error: error?.message,
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      ...meta,
    });
  }
}

// src/api-gateway/common/interceptors/logging.interceptor.ts
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const requestId = request.headers['x-request-id'] || uuidv4();
    
    // Attach request ID to request object
    request.requestId = requestId;
    
    const now = Date.now();
    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const delay = Date.now() - now;
        this.logger.log(
          `${method} ${url} ${response.statusCode} - ${delay}ms`,
          { requestId, method, url, statusCode: response.statusCode, delay },
        );
      }),
      catchError((error) => {
        const delay = Date.now() - now;
        this.logger.error(
          `${method} ${url} ${error.status || 500} - ${delay}ms`,
          error,
          { requestId, method, url },
        );
        throw error;
      }),
    );
  }
}
```

---

### 3. THIẾU: Health Checks

**Vấn đề:**
- Không có health check endpoints
- Không monitor được service health
- Không có readiness/liveness probes cho Kubernetes/Docker

**Tác động:**
- Khó phát hiện service down
- Khó implement auto-scaling
- Khó implement circuit breakers

**Giải pháp:**
```typescript
// src/api-gateway/modules/health/health.controller.ts
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}
  
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.pingCheck('redis'),
    ]);
  }
  
  @Get('readiness')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.pingCheck('redis'),
    ]);
  }
  
  @Get('liveness')
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
```

**Cài đặt:**
```bash
npm install @nestjs/terminus
```

---

### 4. THIẾU: Rate Limiting

**Vấn đề:**
- Không có rate limiting
- Dễ bị DDoS attacks
- Không protect được API endpoints

**Tác động:**
- API có thể bị abuse
- Không fair usage cho users
- Có thể gây overload cho services

**Giải pháp:**
```typescript
// src/api-gateway/common/guards/rate-limit.guard.ts
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

// app.module.ts
ThrottlerModule.forRoot({
  ttl: 60, // 60 seconds
  limit: 100, // 100 requests per minute
}),

// Sử dụng
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {}
```

**Cài đặt:**
```bash
npm install @nestjs/throttler
```

---

### 5. THIẾU: Request ID Tracking

**Vấn đề:**
- Không có request ID để trace request qua multiple services
- Khó debug distributed issues
- Không có correlation tracking

**Giải pháp:**
```typescript
// src/api-gateway/common/interceptors/request-id.interceptor.ts
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const requestId = request.headers['x-request-id'] || uuidv4();
    
    // Attach to request
    request.requestId = requestId;
    
    // Attach to response headers
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-Request-Id', requestId);
    
    return next.handle();
  }
}

// Propagate request ID to microservices
// src/api-gateway/common/interceptors/microservice-request-id.interceptor.ts
@Injectable()
export class MicroserviceRequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const requestId = request.requestId;
    
    return next.handle().pipe(
      tap(() => {
        // Inject request ID vào microservice calls
        // Cần modify ClientProxy để inject headers
      }),
    );
  }
}
```

---

### 6. THIẾU: Circuit Breaker Pattern

**Vấn đề:**
- Không có circuit breaker cho microservice communication
- Khi một service down, có thể gây cascade failure
- Không có fallback mechanism

**Tác động:**
- System không resilient
- Một service down có thể làm toàn bộ system down
- Không có graceful degradation

**Giải pháp:**
```typescript
// src/shared/services/circuit-breaker.service.ts
import { CircuitBreaker } from 'opossum';

@Injectable()
export class CircuitBreakerService {
  private breakers = new Map<string, CircuitBreaker>();
  
  createBreaker<T>(
    name: string,
    fn: () => Promise<T>,
    options?: CircuitBreaker.Options,
  ): CircuitBreaker {
    const breaker = new CircuitBreaker(fn, {
      timeout: 3000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      ...options,
    });
    
    breaker.on('open', () => {
      this.logger.warn(`Circuit breaker ${name} opened`);
    });
    
    breaker.on('halfOpen', () => {
      this.logger.log(`Circuit breaker ${name} half-opened`);
    });
    
    breaker.on('close', () => {
      this.logger.log(`Circuit breaker ${name} closed`);
    });
    
    this.breakers.set(name, breaker);
    return breaker;
  }
}

// Sử dụng trong service
async callMicroservice(pattern: string, data: any) {
  const breaker = this.circuitBreakerService.createBreaker(
    `ms-${pattern}`,
    () => firstValueFrom(this.client.send(pattern, data)),
  );
  
  try {
    return await breaker.fire();
  } catch (error) {
    if (breaker.opened) {
      // Return fallback response
      throw new ServiceUnavailableException('Service temporarily unavailable');
    }
    throw error;
  }
}
```

**Cài đặt:**
```bash
npm install opossum
```

---

### 7. THIẾU: Retry Mechanism

**Vấn đề:**
- Không có retry cho failed microservice calls
- Transient errors có thể fail request
- Không có exponential backoff

**Giải pháp:**
```typescript
// src/shared/services/retry.service.ts
import { retry, catchError, delay, take } from 'rxjs/operators';

@Injectable()
export class RetryService {
  retryWithBackoff<T>(
    source: Observable<T>,
    maxRetries = 3,
    initialDelay = 1000,
  ): Observable<T> {
    return source.pipe(
      retry({
        count: maxRetries,
        delay: (error, retryCount) => {
          const delayMs = initialDelay * Math.pow(2, retryCount - 1);
          this.logger.warn(
            `Retrying after ${delayMs}ms (attempt ${retryCount}/${maxRetries})`,
          );
          return timer(delayMs);
        },
      }),
      catchError((error) => {
        this.logger.error(`Max retries reached: ${error.message}`);
        throw error;
      }),
    );
  }
}

// Sử dụng
const result = await firstValueFrom(
  this.retryService.retryWithBackoff(
    this.client.send(PATTERN, data),
    3, // max retries
    1000, // initial delay 1s
  ),
);
```

---

### 8. THIẾU: Timeout Configuration

**Vấn đề:**
- Không có timeout cho microservice calls
- Request có thể hang indefinitely
- Không có timeout cho database queries

**Giải pháp:**
```typescript
// src/shared/config/microservice.config.ts
export const microserviceConfig = {
  timeout: 5000, // 5 seconds
  retries: 3,
};

// Sử dụng
const result = await firstValueFrom(
  this.client.send(PATTERN, data).pipe(
    timeout(microserviceConfig.timeout),
    catchError((error) => {
      if (error instanceof TimeoutError) {
        throw new RequestTimeoutException('Microservice request timeout');
      }
      throw error;
    }),
  ),
);
```

---

### 9. THIẾU: API Versioning

**Vấn đề:**
- Không có API versioning
- Khó maintain backward compatibility
- Breaking changes sẽ affect tất cả clients

**Giải pháp:**
```typescript
// main.ts
app.setGlobalPrefix('api/v1');

// Hoặc sử dụng versioning strategy
app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '1',
});

// Controller
@Controller({
  path: 'bookings',
  version: '1',
})
export class BookingControllerV1 {}

@Controller({
  path: 'bookings',
  version: '2',
})
export class BookingControllerV2 {}
```

---

### 10. THIẾU: Configuration Management

**Vấn đề:**
- Hardcoded values trong code (e.g., `PAYMENT_EXPIRATION_MINUTES = 15`)
- Không có centralized configuration
- Khó thay đổi config trong production

**Giải pháp:**
```typescript
// src/shared/config/app.config.ts
export default () => ({
  app: {
    port: parseInt(process.env.PORT, 10) || 3000,
    environment: process.env.NODE_ENV || 'development',
  },
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 1434,
    // ...
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    ttl: {
      reservation: parseInt(process.env.RESERVATION_TTL, 10) || 900,
      payment: parseInt(process.env.PAYMENT_TTL, 10) || 900,
    },
  },
  payment: {
    expirationMinutes: parseInt(process.env.PAYMENT_EXPIRATION_MINUTES, 10) || 15,
  },
  microservices: {
    timeout: parseInt(process.env.MS_TIMEOUT, 10) || 5000,
    retries: parseInt(process.env.MS_RETRIES, 10) || 3,
  },
});

// Sử dụng
constructor(private readonly configService: ConfigService) {
  this.paymentExpirationMinutes = this.configService.get<number>('payment.expirationMinutes');
}
```

---

### 11. THIẾU: Monitoring & Observability

**Vấn đề:**
- Không có metrics collection
- Không có distributed tracing
- Không có APM (Application Performance Monitoring)

**Giải pháp:**
```typescript
// Cài đặt Prometheus metrics
npm install @willsoto/nestjs-prometheus prom-client

// src/api-gateway/common/metrics/metrics.module.ts
@Module({
  imports: [PrometheusModule.register()],
})
export class MetricsModule {}

// Sử dụng
import { Counter, Histogram } from 'prom-client';

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
});

const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});
```

---

### 12. THIẾU: Idempotency Keys cho Tất Cả Operations

**Vấn đề:**
- Chỉ có idempotency cho payment
- Các operations khác (booking, reservation) không có idempotency
- Có thể duplicate operations nếu retry

**Giải pháp:**
```typescript
// src/shared/decorators/idempotency.decorator.ts
export const IdempotencyKey = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.headers['idempotency-key'] || null;
  },
);

// Service
async createReservation(
  userId: string,
  dto: CreateReservationDto,
  idempotencyKey?: string,
): Promise<ReservationResponseDto> {
  if (idempotencyKey) {
    const existing = await this.checkIdempotency(idempotencyKey);
    if (existing) {
      return existing;
    }
  }
  
  // Create reservation...
  
  if (idempotencyKey) {
    await this.cacheIdempotencyKey(idempotencyKey, reservation);
  }
  
  return reservation;
}
```

---

### 13. THIẾU: Event-Driven Architecture

**Vấn đề:**
- Synchronous communication giữa services
- Tight coupling giữa services
- Khó scale individual services

**Giải pháp:**
```typescript
// Sử dụng EventEmitter hoặc Message Queue (RabbitMQ, Kafka)
// src/shared/events/booking.events.ts
export class BookingCreatedEvent {
  constructor(
    public readonly bookingId: string,
    public readonly userId: string,
    public readonly totalAmount: number,
  ) {}
}

// Publisher
@Injectable()
export class BookingEventPublisher {
  constructor(
    @Inject('EVENT_BUS') private readonly eventBus: EventBus,
  ) {}
  
  publishBookingCreated(booking: Booking) {
    this.eventBus.publish(
      new BookingCreatedEvent(
        booking.booking_id,
        booking.user?.user_id,
        booking.total_amount,
      ),
    );
  }
}

// Subscriber
@EventsHandler(BookingCreatedEvent)
export class BookingCreatedHandler {
  async handle(event: BookingCreatedEvent) {
    // Send email notification
    // Update analytics
    // etc.
  }
}
```

---

### 14. THIẾU: Saga Pattern cho Distributed Transactions

**Vấn đề:**
- Booking creation involves multiple services (reservation, booking, payment)
- Không có distributed transaction management
- Có thể có inconsistent state nếu một step fails

**Giải pháp:**
```typescript
// src/shared/sagas/booking.saga.ts
@Injectable()
export class BookingSaga {
  async executeCreateBooking(data: CreateBookingData) {
    const sagaId = uuidv7();
    
    try {
      // Step 1: Create booking
      const booking = await this.bookingService.create(data);
      await this.sagaStateService.saveStep(sagaId, 'booking_created', booking);
      
      // Step 2: Create payment
      const payment = await this.paymentService.create(booking.booking_id);
      await this.sagaStateService.saveStep(sagaId, 'payment_created', payment);
      
      // Step 3: Mark reservation as converted
      await this.reservationService.markAsConverted(data.reservationId);
      await this.sagaStateService.saveStep(sagaId, 'reservation_converted', null);
      
      // Complete saga
      await this.sagaStateService.complete(sagaId);
      
      return booking;
    } catch (error) {
      // Compensate: Rollback all steps
      await this.compensate(sagaId);
      throw error;
    }
  }
  
  private async compensate(sagaId: string) {
    const steps = await this.sagaStateService.getSteps(sagaId);
    
    // Reverse in reverse order
    for (const step of steps.reverse()) {
      switch (step.name) {
        case 'reservation_converted':
          // Revert reservation status
          break;
        case 'payment_created':
          // Cancel payment
          break;
        case 'booking_created':
          // Cancel booking
          break;
      }
    }
  }
}
```

---

### 15. THIẾU: Business Logic trong Controllers

**Vấn đề:**
- Một số validation logic trong controllers (e.g., `search.controller.ts`)
- Controllers nên chỉ handle HTTP concerns
- Business logic nên ở services

**Giải pháp:**
```typescript
// BAD: Business logic trong controller
@Get('search')
async searchFlights(@Query() query: SearchFlightsDto) {
  // Validation logic ở đây
  if (query.origin.toUpperCase() === query.destination.toUpperCase()) {
    throw new BadRequestException('Origin and destination must be different');
  }
  // ...
}

// GOOD: Move to service
@Get('search')
async searchFlights(@Query() query: SearchFlightsDto) {
  return this.searchService.searchFlights(query);
}

// Service
async searchFlights(dto: SearchFlightsDto) {
  // Validation
  this.validateSearchCriteria(dto);
  
  // Business logic
  return this.search(dto);
}

private validateSearchCriteria(dto: SearchFlightsDto) {
  if (dto.origin.toUpperCase() === dto.destination.toUpperCase()) {
    throw new BadRequestException('Origin and destination must be different');
  }
  // ...
}
```

---

## PRIORITY MATRIX

### HIGH PRIORITY (Implement ngay)

1. **Global Exception Handler** - Critical cho error handling
2. **Health Checks** - Critical cho production deployment
3. **Request ID Tracking** - Critical cho debugging
4. **Centralized Logging** - Critical cho observability
5. **Rate Limiting** - Critical cho security

### MEDIUM PRIORITY (Implement trong sprint tiếp theo)

6. **Circuit Breaker** - Important cho resilience
7. **Retry Mechanism** - Important cho reliability
8. **Timeout Configuration** - Important cho stability
9. **Configuration Management** - Important cho maintainability
10. **API Versioning** - Important cho backward compatibility

### LOW PRIORITY (Nice to have)

11. **Monitoring & Observability** - Enhance observability
12. **Idempotency Keys** - Enhance reliability
13. **Event-Driven Architecture** - Enhance scalability
14. **Saga Pattern** - Enhance distributed transactions
15. **Refactor Business Logic** - Code quality improvement

---

## IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Week 1-2)
- [ ] Global Exception Handler
- [ ] Centralized Logging Service
- [ ] Request ID Tracking
- [ ] Health Checks

### Phase 2: Resilience (Week 3-4)
- [ ] Circuit Breaker
- [ ] Retry Mechanism
- [ ] Timeout Configuration
- [ ] Rate Limiting

### Phase 3: Observability (Week 5-6)
- [ ] Monitoring & Metrics
- [ ] Distributed Tracing
- [ ] Configuration Management

### Phase 4: Advanced (Week 7-8)
- [ ] API Versioning
- [ ] Event-Driven Architecture
- [ ] Saga Pattern
- [ ] Idempotency Keys

---

## KẾT LUẬN

Dự án hiện tại đã có **nền tảng tốt** về:
- State management ở backend
- Database transactions
- Microservice architecture
- Validation

Tuy nhiên, cần **bổ sung các best practices** để đạt chuẩn enterprise:
- Critical: Exception handling, Health checks, Logging, Rate limiting
- Important: Resilience patterns, Configuration management
- Enhancement: Observability, Event-driven, Distributed transactions

**Recommendation:** Implement theo priority matrix, bắt đầu với High Priority items để đảm bảo system stability và observability trước khi scale.

---

## REFERENCES

- [NestJS Best Practices](https://docs.nestjs.com/recipes/prisma)
- [Microservices Patterns](https://microservices.io/patterns/)
- [Enterprise Integration Patterns](https://www.enterpriseintegrationpatterns.com/)
- [12-Factor App](https://12factor.net/)

