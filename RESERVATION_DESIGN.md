# Reservation Service Design - Redis-based (No Database Table)

## Tổng quan

Reservation Service được tích hợp vào **Booking Microservice** để quản lý state và giữ chỗ tạm thời trước khi tạo booking. **Sử dụng Redis để lưu trữ temporary state, KHÔNG cần tạo table mới trong database.**

## Tại sao dùng Redis thay vì Database Table?

✅ **Ưu điểm của Redis:**
- **Temporary data**: Reservation chỉ tồn tại 15-30 phút, không cần persist lâu dài
- **TTL tự động**: Redis tự động xóa data sau khi hết hạn (không cần cleanup job)
- **Performance**: Redis nhanh hơn database cho read/write operations
- **Không cần migration**: Không phải tạo table, index, trigger mới trong DB
- **Stateless**: Dễ scale và không ảnh hưởng đến database schema

❌ **Nhược điểm của Database Table:**
- Phải tạo table, index, trigger mới
- Cần cleanup job để xóa expired reservations
- Tăng load cho database (reservations là temporary data)
- Phức tạp hơn khi scale

## Flow mới (Backend-managed State với Redis)

```
1. User Search Flights
   ↓
   GET /search/flights
   → Response: flightInstanceId, flightNumber, departure, arrival...

2. User chọn Flight → Get Fare Options
   ↓
   GET /search/fare-options?flightInstanceId=xxx&cabinType=economy
   → Response: fareClassCode, price, desc, availableSeats...

3. User chọn Fare Class → Tạo Reservation (Backend lưu vào Redis)
   ↓
   POST /reservations (với JWT token)
   {
     flightInstanceId: "xxx",  // Từ bước 1
     fareClassCode: "YS",      // Từ bước 2
     numberOfPassengers: 1,
     currencyCode: "VND"
   }
   → Response: {
       reservationId: "xxx",
       reservationCode: "ABC123",
       expiresAt: "2025-01-20T10:30:00",
       totalAmount: 1577000,
       ...
     }

4. Backend tự động (trong BookingService):
   ✅ Validate flightInstanceId và fareClassCode
   ✅ Tính giá từ fareClassCode
   ✅ Check availability
   ✅ Lưu vào Redis với TTL (15 phút)
   ✅ Generate reservationCode (unique)
   ✅ Redis tự động expire sau TTL

5. User điền thông tin passenger → Tạo Booking từ Reservation
   ↓
   POST /bookings?reservationId=xxx (với JWT token)
   {
     passengers: [...],
     contactFullname: "...",
     contactEmail: "...",
     contactPhone: "..."
   }
   → Response: {
       bookingId: "xxx",
       pnrCode: "XYZ789",
       ...
     }

6. Backend tự động:
   ✅ Validate reservation còn active (lấy từ Redis)
   ✅ Convert reservation thành booking (lưu vào DB)
   ✅ Tạo booking với thông tin từ reservation
   ✅ Reservation tự động expire sau khi convert (hoặc để Redis tự xóa)
```

## Redis Keys Structure

```
flight-booking:reservation:{reservationId}     # Reservation data (JSON)
flight-booking:reservation:code:{code}         # Map code -> reservationId (string)
```

**TTL**: 15 phút (900 seconds) - configurable qua `REDIS_RESERVATION_TTL`

## API Endpoints

### 1. Create Reservation
**POST** `/reservations`

Tạo reservation, lưu vào Redis với TTL.

**Authentication:** Required (JWT Bearer Token)

**Request Body:**
```json
{
  "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "fareClassCode": "YS",
  "numberOfPassengers": 1,
  "currencyCode": "VND"
}
```

**Response:**
```json
{
  "reservationId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "reservationCode": "ABC123",
  "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "fareClassCode": "YS",
  "numberOfPassengers": 1,
  "baseFare": 1577000,
  "taxAmount": 0,
  "feeAmount": 0,
  "totalAmount": 1577000,
  "currencyCode": "VND",
  "status": "active",
  "expiresAt": "2025-01-20T10:30:00Z",
  "ttl": 900,
  "createdAt": "2025-01-20T10:15:00Z"
}
```

### 2. Get Reservation
**GET** `/reservations/:id`

Lấy reservation theo ID hoặc code (tự động detect).

**Authentication:** Required (JWT Bearer Token)

**Response:** Same as Create Reservation

### 3. Get Reservation by Code
**GET** `/reservations/code/:code`

Lấy reservation theo code (6 alphanumeric characters).

**Authentication:** Required (JWT Bearer Token)

**Response:** Same as Create Reservation

### 4. Cancel Reservation
**POST** `/reservations/:id/cancel`

Hủy reservation, xóa khỏi Redis.

**Authentication:** Required (JWT Bearer Token)

**Response:**
```json
{
  "success": true,
  "message": "Reservation cancelled successfully"
}
```

## Implementation Details

### BookingService Methods

- `createReservation(userId, dto)`: Tạo reservation, lưu vào Redis
- `getReservation(idOrCode)`: Lấy reservation (auto-detect ID hoặc code)
- `cancelReservation(reservationId)`: Hủy reservation

### RedisService Methods

- `set(key, value, ttl)`: Lưu với TTL
- `get(key)`: Lấy value
- `del(key)`: Xóa key
- `exists(key)`: Check key tồn tại
- `ttl(key)`: Lấy TTL còn lại

## Không cần Database Table

❌ **KHÔNG cần:**
- Table `Reservations` trong database
- Entity `Reservation` trong TypeORM (có thể xóa)
- SQL migration script `add-reservations-table.sql` (có thể xóa)
- Cleanup job để xóa expired reservations
- Index, trigger, foreign keys cho reservations

✅ **Chỉ cần:**
- Redis server (Docker)
- RedisService (đã implement)
- BookingService methods (đã implement)
- API Gateway endpoints (đã implement)

## Environment Variables

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_KEY_PREFIX=flight-booking:
REDIS_RESERVATION_TTL=900  # 15 minutes (in seconds)
```

## Benefits

1. **Không cần migration**: Không phải tạo table mới trong DB
2. **Tự động cleanup**: Redis tự động xóa expired data
3. **Performance**: Redis nhanh hơn database cho temporary data
4. **Scalable**: Dễ scale Redis riêng biệt với database
5. **Simple**: Code đơn giản hơn, không cần entity/table management
