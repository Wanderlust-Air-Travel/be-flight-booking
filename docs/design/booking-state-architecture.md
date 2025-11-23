# Booking State Management Architecture

## Tổng quan

Hệ thống quản lý booking state (cabin và seat selection) được thiết kế theo **Microservice Architecture** với **NestJS Best Practices**, tuân thủ các nguyên tắc:

- **Separation of Concerns** (SoC)
- **Single Responsibility Principle** (SRP)
- **Repository Pattern**
- **Service Layer Pattern**
- **Dependency Injection**
- **Type Safety**

## Kiến trúc

```
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway (Port 3000)                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         BookingStateController                        │  │
│  │  - POST /api/v1/booking-state/cabin                   │  │
│  │  - POST /api/v1/booking-state/seat                   │  │
│  │  - GET  /api/v1/booking-state/:flightInstanceId      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Uses
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Shared BookingStateModule                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         BookingStateService                          │  │
│  │  - Business Logic                                    │  │
│  │  - Validation Rules                                  │  │
│  │  - Error Handling                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                │
│                            │ Uses                           │
│                            ▼                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         BookingStateRepository                       │  │
│  │  - Data Access Layer                                 │  │
│  │  - Redis Operations                                  │  │
│  │  - Key Management                                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Uses
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Redis (State Storage)                     │
│  Key Format: booking:state:{userId}:{flightInstanceId}      │
│  TTL: 30 minutes                                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│         Reservation Microservice (Port 4005)                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         ReservationService                            │  │
│  │  - Uses BookingStateService                           │  │
│  │  - Gets cabin + seat from Redis                       │  │
│  │  - Creates reservation                                │  │
│  │  - Clears booking state after success                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Các thành phần

### 1. Types & Interfaces (`src/shared/types/booking-state.types.ts`)

**Nguyên tắc:** Tách biệt types khỏi business logic

```typescript
export interface CabinSelection {
  flightInstanceId: string;
  cabinType: 'economy' | 'business';
  fareClassCode: string;
}

export interface SeatSelection {
  flightInstanceId: string;
  flightSeatId: string;
  seatNumber: string;
}

export interface BookingState {
  flightInstanceId: string;
  cabin?: CabinSelection;
  seat?: SeatSelection;
  updatedAt: Date;
}
```

### 2. Custom Exceptions (`src/shared/exceptions/booking-state.exceptions.ts`)

**Nguyên tắc:** Domain-specific exceptions với proper HTTP status codes

- `BookingStateException` - Base exception
- `CabinNotSelectedException` - Cabin chưa được chọn
- `SeatNotSelectedException` - Seat chưa được chọn
- `BookingStateNotFoundException` - State không tồn tại
- `BookingStateStorageException` - Lỗi Redis storage

### 3. Repository Pattern (`src/shared/repositories/booking-state.repository.ts`)

**Nguyên tắc:** Abstraction layer cho data access

**Responsibilities:**
- Redis key generation
- CRUD operations
- Error handling và logging
- TTL management

**Methods:**
- `save()` - Lưu state vào Redis
- `findOne()` - Lấy state từ Redis
- `delete()` - Xóa state
- `deleteAllByUserId()` - Xóa tất cả state của user
- `exists()` - Kiểm tra state tồn tại
- `getTtl()` - Lấy TTL còn lại

### 4. Service Layer (`src/shared/services/booking-state.service.ts`)

**Nguyên tắc:** Business logic layer

**Responsibilities:**
- Business rules validation
- State management logic
- Error handling với custom exceptions
- Logging

**Methods:**
- `saveCabinSelection()` - Lưu cabin selection
- `saveSeatSelection()` - Lưu seat selection (validate cabin first)
- `getBookingState()` - Lấy current state
- `getSelectionsForReservation()` - Lấy cabin + seat cho reservation
- `clearBookingState()` - Xóa state sau reservation
- `clearAllUserStates()` - Cleanup tất cả state của user

### 5. Module Structure (`src/shared/modules/booking-state/booking-state.module.ts`)

**Nguyên tắc:** Global module để reuse across microservices

```typescript
@Global()
@Module({
  imports: [RedisModule],
  providers: [BookingStateRepository, BookingStateService],
  exports: [BookingStateRepository, BookingStateService],
})
```

## Best Practices Đã Áp Dụng

### 1. **Separation of Concerns**
- **Types**: Tách riêng trong `types/`
- **Exceptions**: Tách riêng trong `exceptions/`
- **Repository**: Data access layer
- **Service**: Business logic layer
- **Controller**: HTTP layer

### 2. **Repository Pattern**
- Abstraction cho Redis operations
- Dễ dàng thay đổi storage backend
- Testable với mock repository

### 3. **Custom Exceptions**
- Domain-specific error types
- Proper HTTP status codes
- Clear error messages
- Type-safe error handling

### 4. **Logging**
- Structured logging với NestJS Logger
- Log levels: `log`, `warn`, `error`, `debug`
- Context information trong logs

### 5. **Type Safety**
- TypeScript strict mode
- Interface definitions
- Type guards
- No `any` types

### 6. **Error Handling**
- Try-catch blocks
- Custom exception types
- Proper error propagation
- User-friendly error messages

### 7. **Dependency Injection**
- NestJS DI container
- Constructor injection
- Module-based organization

### 8. **Microservice Patterns**
- Shared module cho cross-service functionality
- Stateless services
- Redis for state management
- TTL-based expiration

## Luồng xử lý

### 1. Lưu Cabin Selection

```
Client → API Gateway → BookingStateController
  → BookingStateService
    → BookingStateRepository
      → Redis (save)
```

### 2. Lưu Seat Selection

```
Client → API Gateway → BookingStateController
  → BookingStateService
    → Validate cabin exists
    → BookingStateRepository
      → Redis (save)
```

### 3. Tạo Reservation

```
Client → API Gateway → ReservationController
  → Reservation Microservice
    → ReservationService
      → BookingStateService.getSelectionsForReservation()
        → BookingStateRepository.findOne()
          → Redis (get)
      → Validate và tạo reservation
      → BookingStateService.clearBookingState()
        → BookingStateRepository.delete()
          → Redis (delete)
```

## Redis Key Strategy

**Format:** `booking:state:{userId}:{flightInstanceId}`

**TTL:** 30 minutes (dài hơn reservation TTL 15 phút)

**Lý do:**
- User có thể tạo nhiều reservations từ cùng state
- State tự động expire nếu không sử dụng
- Tránh memory leak

## Error Handling Strategy

1. **Repository Layer**: Catch Redis errors, log, throw `BookingStateStorageException`
2. **Service Layer**: Validate business rules, throw domain exceptions
3. **Controller Layer**: Catch exceptions, map to HTTP responses

## Testing Considerations

### Unit Tests
- Mock `BookingStateRepository`
- Test business logic trong `BookingStateService`
- Test error scenarios

### Integration Tests
- Test với Redis (test container)
- Test end-to-end flow
- Test error handling

## Security Considerations

1. **User Isolation**: State được lưu theo `userId`, không thể access state của user khác
2. **TTL**: State tự động expire sau 30 phút
3. **Validation**: Validate cabin trước seat, validate seat trước reservation

## Performance Considerations

1. **Redis**: Fast in-memory storage
2. **Key Pattern**: Efficient key lookup
3. **TTL**: Automatic cleanup, không cần background job
4. **Caching**: State được cache trong Redis

## Scalability

1. **Stateless**: Service không lưu state trong memory
2. **Redis Cluster**: Có thể scale Redis horizontally
3. **Microservice**: Booking state service có thể tách thành microservice riêng nếu cần

## Future Improvements

1. **Idempotency**: Thêm idempotency keys cho operations
2. **Optimistic Locking**: Handle concurrent updates
3. **Event Sourcing**: Track state changes
4. **Metrics**: Add monitoring và metrics
5. **Circuit Breaker**: Add circuit breaker cho Redis operations

