# Idempotency Key Storage Analysis: DB vs Redis

## Tổng quan

Document này phân tích các phương pháp lưu trữ idempotency key cho Payment Service và đề xuất best practice.

---

## So sánh DB vs Redis

### 1. Database Approach (Hiện tại)

**Ưu điểm:**
- **Persistent**: Không mất data khi restart
- **ACID Guarantee**: Transaction safety, consistency
- **Audit Trail**: Có thể query lịch sử idempotency keys
- **Compliance**: Phù hợp cho financial services, audit requirements
- **No Additional Infrastructure**: Không cần Redis (project đã có nhưng không bắt buộc)
- **Query Flexibility**: Có thể query theo nhiều điều kiện (booking_id, status, created_at)
- **Long-term Storage**: Lưu vĩnh viễn để phục vụ audit, reconciliation

**Nhược điểm:**
- **Performance**: Chậm hơn Redis (network round trip, disk I/O)
- **DB Load**: Tăng tải cho database (critical resource)
- **No TTL**: Không có auto-cleanup, phải manually cleanup old keys
- **Latency**: Higher latency cho hot path (payment creation)
- **Cost**: Database storage cost cao hơn Redis (nhưng không đáng kể cho idempotency keys)

**Use Case:**
- Production với compliance requirements
- Cần audit trail lâu dài
- Low-medium traffic
- Financial transactions cần guarantee

---

### 2. Redis Approach

**Ưu điểm:**
- **Performance**: Rất nhanh (in-memory, < 1ms)
- **Auto TTL**: Tự động cleanup sau X giờ/ngày
- **Reduce DB Load**: Giảm tải cho database
- **Scalability**: Redis có thể scale riêng, không ảnh hưởng DB
- **Perfect for Hot Path**: Phù hợp cho high-traffic scenarios

**Nhược điểm:**
- **Not Persistent by Default**: Có thể mất data khi Redis restart (nếu không có persistence)
- **No Audit Trail**: Không lưu lâu dài, khó query historical data
- **Complexity**: Cần handle Redis connection issues, fallback
- **Compliance Issues**: Khó đáp ứng audit requirements cho financial services
- **Data Loss Risk**: Nếu Redis crash, có thể mất idempotency keys đang trong window

**Use Case:**
- High-traffic scenarios
- Temporary idempotency window (1-24 hours)
- Performance-critical paths
- Không cần audit trail lâu dài

---

## Best Practice: Hybrid Approach (Recommended)

**Kết hợp cả 2:** Redis cho performance + DB cho persistence & audit

### Architecture

```
┌─────────────────┐
│  Client Request │
│ (idempotencyKey)│
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  Check Redis First      │ ◄─── Fast path (< 1ms)
│  (hot cache)            │
└────────┬────────────────┘
         │
    ┌────┴────┐
    │ Found?  │
    └────┬────┘
         │
    ┌────┴────────┐
    │ Yes         │ No
    ▼             ▼
┌────────┐  ┌──────────────────┐
│ Return │  │ Check DB (fallback)│ ◄─── Guarantee path
│ Payment│  │ or create new     │
└────────┘  └──────┬───────────┘
                   │
              ┌────┴────┐
              │ Create? │
              └────┬────┘
                   │
              ┌────┴──────────────┐
              │                   │
              ▼                   ▼
    ┌─────────────────┐  ┌──────────────┐
    │ Save to Redis   │  │ Save to DB   │
    │ (TTL: 1-2 hours)│  │ (permanent)  │
    └─────────────────┘  └──────────────┘
```

### Implementation Flow

```typescript
async createPayment(userId: string, dto: CreatePaymentDto): Promise<PaymentResponseDto> {
  if (!dto.idempotencyKey) {
    // No idempotency key, proceed normally
    return this.createNewPayment(userId, dto);
  }

  // Step 1: Check Redis (fast path)
  const cachedPayment = await this.redisService.get(
    `idempotency:${dto.idempotencyKey}`
  );
  
  if (cachedPayment) {
    this.logger.log(`Idempotency hit from Redis: ${dto.idempotencyKey}`);
    return JSON.parse(cachedPayment); // Return cached payment
  }

  // Step 2: Check DB (fallback/guarantee)
  const existingPayment = await this.checkIdempotencyFromDB(
    dto.idempotencyKey,
    dto.bookingId
  );

  if (existingPayment) {
    // Cache in Redis for future requests (TTL: 2 hours)
    await this.redisService.setex(
      `idempotency:${dto.idempotencyKey}`,
      7200, // 2 hours
      JSON.stringify(this.mapToPaymentResponseDto(existingPayment))
    );
    
    this.logger.log(`Idempotency hit from DB: ${dto.idempotencyKey}`);
    return this.mapToPaymentResponseDto(existingPayment);
  }

  // Step 3: Create new payment (save to both Redis and DB)
  const newPayment = await this.createNewPayment(userId, dto);

  // Save to Redis with TTL
  await this.redisService.setex(
    `idempotency:${dto.idempotencyKey}`,
    7200, // 2 hours (configurable)
    JSON.stringify(this.mapToPaymentResponseDto(newPayment))
  ).catch(err => {
    // Redis failure should not block payment creation
    this.logger.warn(`Failed to cache idempotency key in Redis: ${err.message}`);
  });

  // Save to DB (already done in createNewPayment)
  // idempotency_key is persisted in Payments table

  return newPayment;
}
```

### Key Design Decisions

1. **Redis TTL**: 1-2 giờ (đủ cho duplicate requests trong window critical)
   - Payment expiration: 15 phút
   - Redis TTL: 2 giờ (cover cả retry scenarios)

2. **Redis Key Format**: `idempotency:{idempotencyKey}`
   - Namespace để tránh conflict
   - Easy to cleanup/query

3. **Fallback Strategy**: DB-first nếu Redis fail
   - Đảm bảo không mất idempotency guarantee
   - Redis failure không block payment creation

4. **Cache Value**: Store payment response DTO
   - Tránh query lại DB
   - Serialize to JSON

5. **Persistence**: Luôn save vào DB
   - Audit trail vĩnh viễn
   - Compliance requirements
   - Reconciliation

---

## Performance Comparison

### Current (DB-only)

```
Request → Check DB → Create Payment → Save DB
Average latency: ~20-50ms (network + disk I/O)
```

### Proposed (Hybrid)

```
Request → Check Redis → [Hit] Return (99% cases) → ~1ms
          ↓ [Miss]
          Check DB → [Hit] Cache & Return → ~20-50ms
          ↓ [Miss]
          Create Payment → Save Both → ~20-50ms
Average latency: ~1-2ms (99% from Redis cache)
```

**Performance Improvement: ~95% latency reduction**

---

## Safety & Guarantee

### Idempotency Window

```
┌─────────────────────────────────────────┐
│  Time Window for Idempotency Check     │
├─────────────────────────────────────────┤
│  Redis: 0-2 hours (fast, temporary)    │
│  DB:    Permanent (audit, guarantee)   │
└─────────────────────────────────────────┘
```

### Failure Scenarios

| Scenario | Redis Only | DB Only | Hybrid |
|----------|------------|---------|--------|
| Redis down | Lose guarantee | OK | Fallback to DB |
| DB down | OK (short-term) | All fail | All fail (expected) |
| Cache miss | Query DB every time | N/A | Query DB, then cache |
| Long-term audit | No data | Full history | Full history |

**Conclusion:** Hybrid approach cung cấp best of both worlds với minimal trade-offs.

---

## Recommendation for Payment Service

### **Recommendation: Hybrid Approach**

**Lý do:**
1. **Project đã có Redis** (cho Reservation Service)
2. **Payment là critical path** - cần performance
3. **Financial transactions** - cần audit trail (DB)
4. **Best of both worlds** - performance + guarantee

### Implementation Priority

**Phase 1: Keep Current (DB-only)** - Already implemented
- Stable, working
- Good for current traffic

**Phase 2: Add Redis Cache** - Recommended next step
- Add Redis caching layer
- Fallback to DB if Redis fails
- Keep DB as source of truth

**Phase 3: Monitoring & Optimization**
- Monitor Redis hit rate
- Adjust TTL based on traffic patterns
- Cleanup strategy for old idempotency keys in DB (optional)

---

## Alternative: Pure Redis với DB Async Backup

**Chỉ cho high-performance scenarios:**

```typescript
// Option: Redis-first, async DB backup
async createPayment(userId: string, dto: CreatePaymentDto) {
  // 1. Check Redis (primary)
  // 2. If not found, create payment
  // 3. Save to Redis immediately (TTL: 2h)
  // 4. Async save to DB (non-blocking)
}

// Background job: Sync Redis → DB periodically
```

**Trade-offs:**
- Risk of data loss nếu Redis crash before DB sync
- Maximum performance
- Không phù hợp cho financial services (audit requirement)

**Recommendation:** Không recommend cho Payment Service (cần guarantee)

---

## Implementation Checklist

### If implementing Hybrid Approach:

- [ ] Add Redis client to Payment Service module
- [ ] Implement Redis cache layer với TTL
- [ ] Fallback logic: Redis → DB
- [ ] Error handling: Redis failures không block payment
- [ ] Logging: Track Redis hit/miss rates
- [ ] Monitoring: Redis connection health
- [ ] Configuration: TTL configurable (env variable)
- [ ] Testing: Unit tests cho cache logic
- [ ] Testing: Integration tests với Redis down scenario

### Configuration

```env
# Redis for Idempotency (optional, uses same Redis as Reservation)
REDIS_IDEMPOTENCY_TTL=7200  # 2 hours in seconds
REDIS_IDEMPOTENCY_KEY_PREFIX=idempotency:
REDIS_IDEMPOTENCY_ENABLED=true  # Feature flag
```

---

## Industry Best Practices

### AWS API Gateway
- Sử dụng **distributed cache** (DynamoDB hoặc ElastiCache)
- TTL: 1 hour
- Check cache trước, fallback to storage

### Stripe
- **Idempotency keys** lưu trong database
- Window: 24 hours
- No Redis (rely on DB performance với proper indexing)

### PayPal
- **Hybrid approach**:
  - Redis cho hot path (1-2 hours)
  - Database cho audit trail (permanent)

### Square
- **Database-first** với caching layer
- Focus on consistency over performance

---

## Conclusion

**For Payment Service:**
- **Current (DB-only)**: Good enough cho current scale
- **Recommended (Hybrid)**: Best practice cho production scale
- **Pure Redis**: Không recommend (lose audit trail)

**Next Steps:**
1. Monitor current performance
2. If latency becomes issue → implement hybrid
3. If low traffic → keep DB-only (simpler)

