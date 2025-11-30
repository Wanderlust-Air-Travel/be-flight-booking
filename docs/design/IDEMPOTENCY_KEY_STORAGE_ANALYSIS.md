# Idempotency Key Storage - Hybrid Approach

## Tổng quan

Payment Service sử dụng **Hybrid Approach** cho idempotency key storage:
- **Redis**: Fast cache (TTL: 2 hours) - 99% hit rate
- **Database**: Persistent storage & guarantee - fallback khi Redis miss/fail

## Architecture

```
Client Request (idempotencyKey)
  ↓
Check Redis First (fast path ~1ms)
  ↓
Found? → Return existing payment
  ↓
Not Found → Check DB (fallback ~20-50ms)
  ↓
Found? → Cache in Redis + Return
  ↓
Not Found → Create new payment → Save Both (Redis + DB)
```

## Performance

- **Before (DB-only)**: ~20-50ms average
- **After (Hybrid)**: ~1-2ms average (99% from Redis cache)
- **Improvement**: ~95% latency reduction

## Safety & Guarantee

| Scenario | Behavior |
|----------|----------|
| Redis down |  Fallback to DB (guarantee maintained) |
| Redis slow |  Timeout → Fallback to DB |
| DB down |  All fail (expected, can't create payment) |
| Cache miss |  Query DB, then cache for future |

## Configuration

```env
REDIS_IDEMPOTENCY_TTL=7200  # 2 hours (in seconds)
REDIS_IDEMPOTENCY_ENABLED=true  # Enable/disable Redis caching
```

## Implementation

- **File**: `src/microservices/payment/services/payment-validation.service.ts`
- **Method**: `checkIdempotency()` - Hybrid check (Redis → DB fallback)
- **Redis Key Format**: `idempotency:{idempotencyKey}`
