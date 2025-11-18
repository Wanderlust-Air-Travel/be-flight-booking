# Reservation Expiration Validation - Best Practice

## Câu hỏi: Nên validate dựa vào `status` hay `expiresAt`?

## Best Practice: Check `expiresAt` First (Primary), `status` Second (Secondary)

**Lý do:**
1. **Source of Truth** - `expiresAt` là timestamp thực tế, không phụ thuộc vào computed fields
2. **Real-time Accuracy** - Luôn chính xác, không cần đợi background jobs
3. **Industry Standard** - Airline, e-commerce, payment systems đều dùng timestamp
4. **Race Condition Safe** - Không bị ảnh hưởng bởi timing của cleanup jobs

## Implementation

```typescript
// Step 1: Check expiresAt (Primary - Source of Truth)
const now = new Date();
const expiresAt = new Date(reservation.expiresAt);
if (expiresAt < now) {
    throw new BadRequestException('Reservation has expired');
}

// Step 2: Check status (Secondary - Optimization)
if (reservation.status === 'expired' || reservation.status === 'cancelled' || reservation.status === 'converted') {
    throw new BadRequestException(`Reservation status: ${reservation.status}`);
}
```

**Logic:**
- `expiresAt` là primary check (source of truth)
- `status` là secondary check (optimization, early rejection)
- Accept both 'active' (from Redis) and 'pending' (from Database) as valid

## Edge Cases

**Case 1: Reservation vừa expired nhưng status chưa update**
- Check `expiresAt` first → Reject (correct)
- Nếu chỉ check `status` → Accept (wrong!)

**Case 2: Status = 'expired' nhưng expiresAt chưa đến**
- Check `expiresAt` first → Accept
- Check `status` second → Reject (correct - business logic)

**Case 3: Background job chưa chạy**
- Check `expiresAt` → Reject (correct)
- Nếu chỉ check `status` → Accept (wrong!)

## Conclusion

**Best Practice: Check `expiresAt` First (Primary), `status` Second (Secondary)**