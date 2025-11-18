# Backend State Management Analysis & Best Practices

## Tổng quan

Phân tích đảm bảo **Backend tự quản lý state**, không để Frontend quản lý. Best practices cho Microservices, NestJS và TypeScript.

## Current Status: 100% Backend-managed (COMPLETED)

**Đã hoàn thành:**
1. Deprecate legacy booking flow - `reservationId` là REQUIRED
2. Multi-segment reservation - Support round-trip trong 1 reservation
3. Cleanup - Đã xóa hoàn toàn backward compatibility code

**Kết quả:** Backend quản lý 100% state, frontend chỉ cần lưu `reservationId`.

## Best Practices

### DO (Backend-managed State)
1. Use Reservation for Temporary State - Frontend chỉ cần lưu reservationId
2. Extract User Info from JWT - Never trust frontend-sent userId
3. Calculate Pricing on Backend - Never trust frontend-sent prices
4. Validate Everything - Flight availability, fare class, ownership, expiration
5. Use Database for Persistent State - Users, Passengers, Bookings → Database

### DON'T (Frontend-managed State)
1. Don't let frontend send pricing
2. Don't let frontend manage flight selections
3. Don't let frontend calculate totals
4. Don't use frontend storage for critical data

## Architecture

**Frontend State:**
- JWT tokens (localStorage)
- Reservation ID (temporary, in-memory)

**Backend State:**
- Reservations (Redis + Database)
- Users (Database)
- Passengers (Database)
- Bookings (Database)

## References

- Implementation details: `docs/api/CHANGELOG_API_DOCS.md`
- Reservation Storage: `docs/design/RESERVATION_STORAGE_ANALYSIS.md`
- API Documentation: `docs/api/API_DOCS.md`
