# Booking State Seat API Documentation

## Overview

API endpoint để lưu seat selection vào Redis booking state. Đây là bước quan trọng trong booking flow, cho phép backend lấy seat selection khi tạo reservation. **Seat validation được thực hiện trước khi lưu vào booking state** để đảm bảo data integrity.

## Endpoint

**POST** `/api/v1/booking-state/seat`

## Authentication

**Required**: Bearer Token (JWT)

```
Authorization: Bearer <access_token>
```

## Request Body

```json
{
  "flightInstanceId": "019AB859-BB93-70F2-B24A-984A8513DC40",
  "flightSeatId": "019AB859-BB93-70F2-B24A-984A8513DC41",
  "seatNumber": "10A"
}
```

### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `flightInstanceId` | string (UUID v7) | Yes | ID của flight instance đã chọn |
| `flightSeatId` | string (UUID v7) | Yes | ID của seat trong database |
| `seatNumber` | string | Yes | Số ghế (ví dụ: "10A", "12F") |

## Validation Rules

### 1. **Cabin Selection Required**
- Cabin phải được chọn trước khi chọn seat
- Nếu cabin chưa được chọn, returns `400 Bad Request` với message: `"Cabin must be selected before selecting a seat"`

### 2. **Flight Instance Validation**
- Flight instance phải tồn tại trong database
- Returns `404 Not Found` nếu flight instance không tồn tại

### 3. **Seat Existence Validation**
- Seat phải tồn tại trong database với `flightSeatId` được cung cấp
- Returns `400 Bad Request` với message: `"Seat {flightSeatId} not found. Please select a valid seat."`

### 4. **Seat-Flight Instance Match**
- Seat phải thuộc về flight instance được chỉ định
- Returns `400 Bad Request` với message: `"Seat {seatNumber} ({flightSeatId}) does not belong to flight instance {flightInstanceId}. Please select a seat from the correct flight."`

### 5. **Seat Number Validation**
- Seat number phải khớp với seat ID
- Returns `400 Bad Request` với message: `"Seat number mismatch. Expected {expectedSeatNumber} for seat {flightSeatId}, but received {providedSeatNumber}."`

### 6. **Seat Availability**
- Seat phải có sẵn (`is_available = true`)
- Returns `400 Bad Request` với message: `"Seat {seatNumber} is not available. Please select another seat."`

### 7. **Cabin Class Match** (BEST PRACTICE - Most Important)
- Seat phải thuộc về cabin class đã được chọn trong booking state
- Economy seats chỉ có thể được chọn khi đã chọn Economy cabin
- Business seats chỉ có thể được chọn khi đã chọn Business cabin
- Returns `400 Bad Request` với message: `"Seat {seatNumber} is in {actualCabinClass} class, but you selected {expectedCabinClass} class. Please select a seat from the correct cabin."`

**Validation Flow:**
```
1. Check cabin selection exists in booking state
2. Validate flight instance exists
3. Validate seat exists
4. Validate seat belongs to correct flight instance
5. Validate seat number matches
6. Validate seat is available
7. Validate seat matches cabin class from booking state (most important)
```

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Seat selection saved successfully"
}
```

### Error Responses

#### 400 Bad Request - Cabin Not Selected

```json
{
  "statusCode": 400,
  "message": "Cabin must be selected before selecting a seat. Please select cabin first using /api/v1/booking-state/cabin endpoint.",
  "error": "Bad Request"
}
```

#### 400 Bad Request - Seat Not Found

```json
{
  "statusCode": 400,
  "message": "Seat 01900000-0000-7000-8000-000000000000 not found. Please select a valid seat.",
  "error": "Bad Request"
}
```

#### 400 Bad Request - Seat From Different Flight

```json
{
  "statusCode": 400,
  "message": "Seat 10A (019AB859-E2AA-75C0-87F7-EBCA04A8B763) does not belong to flight instance 019AB859-CF32-71DF-854A-C349FE354A0D. Please select a seat from the correct flight.",
  "error": "Bad Request"
}
```

#### 400 Bad Request - Seat Not Available

```json
{
  "statusCode": 400,
  "message": "Seat 10A is not available. Please select another seat.",
  "error": "Bad Request"
}
```

#### 400 Bad Request - Cabin Class Mismatch

```json
{
  "statusCode": 400,
  "message": "Seat 10A is in Business class, but you selected Economy class. Please select a seat from the correct cabin.",
  "error": "Bad Request"
}
```

#### 401 Unauthorized

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

#### 404 Not Found - Flight Instance Not Found

```json
{
  "statusCode": 404,
  "message": "Flight instance 019AB859-CF32-71DF-854A-C349FE354A0D not found",
  "error": "Not Found"
}
```

## Storage

- **Storage**: Redis
- **Key Format**: `booking:state:{userId}:{flightInstanceId}:seat`
- **TTL**: 30 minutes (auto-expire, cùng với cabin selection)
- **Auto-cleanup**: State được tự động xóa sau khi tạo reservation thành công

## Integration with Reservation API

Sau khi lưu seat selection, khi tạo reservation:
- Backend tự động lấy cabin và seat selection từ booking state
- Seat được giữ (hold) khi tạo reservation
- Booking state được clear sau khi reservation được tạo thành công

**Example Flow:**
1. User chọn cabin → `POST /api/v1/booking-state/cabin` (lưu vào Redis)
2. User chọn seat → `POST /api/v1/booking-state/seat` (validate và lưu vào Redis)
3. User tạo reservation → `POST /api/v1/reservations` (tự động lấy cabin + seat từ Redis, seat được hold)
4. Backend tự động clear booking state sau khi reservation thành công

## Best Practices

1. **Save cabin selection first** - Cabin phải được chọn trước khi chọn seat
2. **Validate before save** - Backend validate tất cả seat properties trước khi lưu vào booking state
3. **Handle errors gracefully** - Frontend nên hiển thị error messages rõ ràng cho user
4. **Clear state on navigation** - Nếu user quay lại search, có thể xóa state cũ bằng `DELETE /api/v1/booking-state/:flightInstanceId`

## Related APIs

- `POST /api/v1/booking-state/cabin` - Save cabin selection (must be called first)
- `GET /api/v1/booking-state/:flightInstanceId` - Get booking state
- `DELETE /api/v1/booking-state/:flightInstanceId` - Clear booking state
- `POST /api/v1/reservations` - Create reservation (uses cabin + seat from booking state)

## Implementation Details

### Files Changed

- `src/api-gateway/modules/booking-state/booking-state.controller.ts` - Added seat validation logic
- `src/api-gateway/modules/booking-state/booking-state.module.ts` - Added TypeORM repositories for validation
- `src/api-gateway/modules/booking-state/dto/save-seat-selection.dto.ts` - DTO definition

### Validation Logic

```typescript
private async validateSeatSelection(dto: SaveSeatSelectionDto, userId: string): Promise<void> {
  // 1. Check cabin selection exists
  const bookingState = await this.bookingStateService.getBookingState(userId, dto.flightInstanceId);
  if (!bookingState || !bookingState.cabin) {
    throw new CabinNotSelectedException(dto.flightInstanceId);
  }

  // 2. Validate flight instance exists
  const flightInstance = await this.flightInstanceRepo.findOne({
    where: { flight_instance_id: dto.flightInstanceId },
  });
  if (!flightInstance) {
    throw new NotFoundException(`Flight instance ${dto.flightInstanceId} not found`);
  }

  // 3. Validate seat exists
  const flightSeat = await this.flightSeatRepo.findOne({
    where: { flight_seat_id: dto.flightSeatId },
    relations: ['seat_config', 'seat_config.cabin_class', 'flight_instance'],
  });
  if (!flightSeat) {
    throw new BadRequestException(`Seat ${dto.flightSeatId} not found. Please select a valid seat.`);
  }

  // 4. Validate seat belongs to correct flight instance
  if (flightSeat.flight_instance_id !== dto.flightInstanceId) {
    throw new BadRequestException(`Seat ${dto.seatNumber} does not belong to flight instance ${dto.flightInstanceId}.`);
  }

  // 5. Validate seat number matches
  if (flightSeat.seat_number !== dto.seatNumber) {
    throw new BadRequestException(`Seat number mismatch.`);
  }

  // 6. Validate seat is available
  if (!flightSeat.is_available) {
    throw new BadRequestException(`Seat ${dto.seatNumber} is not available.`);
  }

  // 7. Validate seat matches cabin class (MOST IMPORTANT)
  const fareClass = await this.fareClassRepo.findOne({
    where: { fare_class_code: bookingState.cabin.fareClassCode },
    relations: ['cabin_class'],
  });
  const expectedCabinClassCode = fareClass.cabin_class.cabin_class_code;
  const actualCabinClassCode = flightSeat.seat_config.cabin_class.cabin_class_code;
  
  if (actualCabinClassCode !== expectedCabinClassCode) {
    throw new BadRequestException(`Seat ${dto.seatNumber} is in ${actualCabinClassCode} class, but you selected ${expectedCabinClassCode} class.`);
  }
}
```

### Best Practices Applied

1. **Early Validation** - Validate seat properties before saving to booking state (fail fast principle)
2. **Comprehensive Validation** - Check all seat properties (existence, availability, flight instance match, cabin class match)
3. **TypeORM Relations** - Load relations efficiently to validate cabin class match
4. **Clear Error Messages** - Provide specific error messages for each validation failure
5. **Database-First Validation** - Query database to validate seat properties, not just trust client input

## Changelog

- **2025-11-26**: Added comprehensive seat validation before saving to booking state
  - Validate seat exists
  - Validate seat belongs to correct flight instance
  - Validate seat number matches
  - Validate seat is available
  - Validate seat matches cabin class from booking state
- **2025-11-26**: Improved error messages with specific validation failures
- **2025-11-26**: Added TypeORM repositories to booking-state module for database validation
