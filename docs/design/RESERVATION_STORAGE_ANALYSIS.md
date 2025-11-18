# Reservation Storage Analysis - Redis vs Database

## Vấn đề

**Reservation chỉ lưu trên Redis:**
- Không persistent - Mất data nếu Redis restart/crash
- Không có audit trail - Không biết lịch sử
- Không có analytics - Không thể phân tích conversion rate
- Không có recovery - Nếu Redis down, user mất reservation

## Giải pháp: Hybrid Approach - Database + Redis (COMPLETED)

**Database (Persistent Storage):**
- Audit trail với timestamps
- Analytics (conversion rate, abandonment rate)
- Recovery nếu Redis down
- Status tracking: `pending`, `expired`, `converted`, `cancelled`

**Redis (Fast Cache):**
- Fast read/write operations
- TTL tự động cleanup (15 phút)
- Active status: `active` trong Redis vs `pending` trong Database

## Flow

**Create Reservation:**
1. Save to Database (persistent) → status = 'pending'
2. Save to Redis (cache) → TTL 15 phút
3. Return reservationId

**Get Reservation:**
1. Try Redis first (fast)
2. If not found, check Database (fallback)
3. If found in DB but expired, update status = 'expired'
4. Re-cache to Redis if active

**Create Booking:**
1. Get reservation from Redis or Database
2. Create booking
3. Update reservation status = 'converted' in Database
4. Delete from Redis

## Lợi ích

1. Reliability - Không mất data (Database persistent)
2. Analytics - Track conversion rate, abandonment rate
3. Audit Trail - Compliance, debugging
4. Recovery - Fallback khi Redis down
5. Business Intelligence - Phân tích user behavior

## Implementation Status

1. COMPLETED - Thêm Database table cho Reservations
2. COMPLETED - Update create/get reservation để save/read từ cả 2
3. COMPLETED - Cleanup method cho expired reservations
4. COMPLETED - Update Booking Service để mark reservation as converted

## Database Schema

```sql
CREATE TABLE Reservations (
    reservation_id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    reservation_code VARCHAR(6) NOT NULL UNIQUE,
    user_id UNIQUEIDENTIFIER NULL,
    segments_json NVARCHAR(MAX) NOT NULL,
    number_of_passengers INT NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    currency_code CHAR(3) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    expires_at DATETIME2 NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    converted_at DATETIME2 NULL
);
```

## References

- [Redis Persistence](https://redis.io/docs/management/persistence/)
- [Booking.com Architecture](https://www.infoq.com/presentations/booking-com-architecture/)
