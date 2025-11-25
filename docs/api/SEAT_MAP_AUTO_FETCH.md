# Seat Map API - Auto-fetch Cabin Type from Booking State

## Overview

API `GET /api/v1/search/seats` đã được cải tiến để tự động lấy `cabinType` từ Redis booking state nếu user đã đăng nhập và đã lưu cabin selection trước đó. Điều này cải thiện UX và giảm số lượng API calls.

## Endpoint

**GET** `/api/v1/search/seats`

## Authentication

**Optional**: Bearer Token (JWT)

```
Authorization: Bearer <access_token>
```

- **With Token**: Tự động lấy `cabinType` từ booking state nếu đã lưu
- **Without Token**: Phải truyền `cabinType` trong query parameters

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `flightInstanceId` | string (UUID v7) | Yes | ID của flight instance |
| `cabinType` | string | **Optional** | Loại cabin: `"economy"` hoặc `"business"` |

### Priority Logic

1. **Query Parameter** (Highest Priority): Nếu truyền `cabinType` trong query, sẽ dùng giá trị này
2. **Booking State** (Auto-fetch): Nếu không truyền `cabinType` và user đã đăng nhập:
   - Tự động lấy từ Redis booking state
   - Key: `booking:state:{userId}:{flightInstanceId}:cabin`
3. **Error**: Nếu không có cả query parameter và booking state, trả về `400 Bad Request`

## Request Examples

### Example 1: With Token (Auto-fetch from Booking State)

```http
GET /api/v1/search/seats?flightInstanceId=019AB859-BB93-70F2-B24A-984A8513DC40
Authorization: Bearer <access_token>
```

**Behavior**: Tự động lấy `cabinType` từ booking state (nếu đã lưu trước đó)

### Example 2: Explicit Cabin Type (Override)

```http
GET /api/v1/search/seats?flightInstanceId=019AB859-BB93-70F2-B24A-984A8513DC40&cabinType=business
Authorization: Bearer <access_token>
```

**Behavior**: Dùng `cabinType=business` từ query parameter (override booking state)

### Example 3: Without Token (Must Provide Cabin Type)

```http
GET /api/v1/search/seats?flightInstanceId=019AB859-BB93-70F2-B24A-984A8513DC40&cabinType=economy
```

**Behavior**: Phải truyền `cabinType` vì không có token để auto-fetch

## Response

### Success Response (200 OK)

```json
{
  "flightInstanceId": "019AB859-BB93-70F2-B24A-984A8513DC40",
  "flightNumber": "VJ0215",
  "cabinType": "economy",
  "seats": [
    {
      "id": "economy",
      "list": [
        {
          "flightSeatId": "019AB859-BB93-70F2-B24D-152FE58CFA84",
          "seatNumber": "10A",
          "cabinClassCode": "Y",
          "seatType": "Window",
          "isExitRow": true,
          "position": "left",
          "isAvailable": true,
          "note": "es",
          "isSelectable": true
        }
      ]
    },
    {
      "id": "business",
      "list": [...]
    }
  ]
}
```

### Error Responses

#### 400 Bad Request - Missing Cabin Type

```json
{
  "statusCode": 400,
  "message": "cabinType is required. Either provide it in query parameters or ensure you have saved cabin selection in booking state.",
  "error": "Bad Request"
}
```

#### 404 Not Found - Flight Instance Not Found

```json
{
  "statusCode": 404,
  "message": "Flight instance not found",
  "error": "Not Found"
}
```

## Implementation Details

### OptionalJwtAuthGuard

Guard mới cho phép optional authentication:
- Extract `userId` từ JWT token nếu có
- Không block request nếu không có token
- Cho phép API hoạt động với hoặc không có authentication

**File**: `src/api-gateway/modules/auth/guard/optional-jwt-auth.guard.ts`

### Auto-fetch Logic

```typescript
// 1. Check query parameter first (highest priority)
if (cabinType) {
  // Use query parameter
  return await this.getSeatMap(flightInstanceId, cabinType);
}

// 2. Try to get from booking state (if user is authenticated)
if (user?.userId) {
  const bookingState = await this.bookingStateService.getCabinSelection(
    user.userId,
    flightInstanceId
  );
  if (bookingState?.cabinType) {
    // Use from booking state
    return await this.getSeatMap(flightInstanceId, bookingState.cabinType);
  }
}

// 3. Error if neither available
throw new BadRequestException('cabinType is required...');
```

## Benefits

1. **Improved UX**: User không cần truyền `cabinType` lại sau khi đã chọn cabin
2. **Reduced API Calls**: Frontend không cần lưu `cabinType` trong state
3. **Backward Compatible**: Vẫn hỗ trợ explicit `cabinType` trong query parameters
4. **Flexible**: Query parameters luôn có priority cao hơn booking state

## Related APIs

- `POST /api/v1/booking-state/cabin` - Save cabin selection (required before auto-fetch)
- `GET /api/v1/search/fare-options` - Get fare options (also supports auto-fetch)

## Changelog

- **2025-11-25**: Added auto-fetch cabinType from booking state
- **2025-11-25**: Added OptionalJwtAuthGuard for optional authentication
- **2025-11-25**: Query parameters have priority over booking state

