# Booking State Cabin API Documentation

## Overview

API endpoint để lưu cabin selection (Economy/Business) vào Redis booking state. Đây là bước quan trọng trong booking flow, cho phép backend tự động lấy cabin type khi user chọn ghế ngồi.

## Endpoint

**POST** `/api/v1/booking-state/cabin`

## Authentication

**Required**: Bearer Token (JWT)

```
Authorization: Bearer <access_token>
```

## Request Body

```json
{
  "flightInstanceId": "019AB859-BB93-70F2-B24A-984A8513DC40",
  "cabinType": "economy",
  "fareClassCode": "YS"
}
```

### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `flightInstanceId` | string (UUID v7) | Yes | ID của flight instance đã chọn |
| `cabinType` | string | Yes | Loại cabin: `"economy"` hoặc `"business"` |
| `fareClassCode` | string | Yes | Mã fare class đã chọn (ví dụ: `"YS"`, `"YF"`, `"JS"`, `"JF"`) |

### Validation Rules

1. **Cabin Type Validation**:
   - Must be `"economy"` or `"business"`

2. **Fare Class Code Validation**:
   - **Economy**: `fareClassCode` must start with `'Y'` (e.g., `'YS'`, `'YF'`, `'YSM'`)
   - **Business**: `fareClassCode` must start with `'J'` (e.g., `'JS'`, `'JF'`, `'JFLX'`)
   - If validation fails, returns `400 Bad Request` with `InvalidFareClassException`

3. **Flight Instance ID**:
   - Must be valid UUID v7 format

## Response

### Success Response (200 OK)

```json
{
  "flightInstanceId": "019AB859-BB93-70F2-B24A-984A8513DC40",
  "cabinType": "economy",
  "fareClassCode": "YS",
  "userId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "expiresAt": "2025-11-25T17:00:00.000Z"
}
```

### Error Responses

#### 400 Bad Request - Invalid Fare Class

```json
{
  "statusCode": 400,
  "message": "Invalid fare class code 'JS' for cabin type 'economy'. Economy fare classes must start with 'Y'.",
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
  "message": "Flight instance not found",
  "error": "Not Found"
}
```

## Storage

- **Storage**: Redis
- **Key Format**: `booking:state:{userId}:{flightInstanceId}:cabin`
- **TTL**: 30 minutes (auto-expire)
- **Auto-cleanup**: State được tự động xóa sau khi tạo reservation thành công

## Integration with Seat Map API

Sau khi lưu cabin selection, API `GET /api/v1/search/seats` có thể tự động lấy `cabinType` từ Redis nếu:
- User đã đăng nhập (có JWT token)
- Đã lưu cabin selection trước đó
- Không truyền `cabinType` trong query parameters

**Example Flow**:
1. User chọn cabin → `POST /api/v1/booking-state/cabin` (lưu vào Redis)
2. User xem seat map → `GET /api/v1/search/seats?flightInstanceId=xxx` (tự động lấy cabinType từ Redis)

## Best Practices

1. **Save cabin selection immediately** sau khi user chọn cabin và fare class
2. **Handle errors gracefully** - nếu save fail, vẫn cho phép user tiếp tục nhưng sẽ phải truyền cabinType manually
3. **Clear state on navigation** - nếu user quay lại search, có thể xóa state cũ bằng `DELETE /api/v1/booking-state/:flightInstanceId`

## Related APIs

- `GET /api/v1/search/seats` - Get seat map (auto-fetches cabinType from booking state)
- `GET /api/v1/booking-state/:flightInstanceId` - Get booking state
- `DELETE /api/v1/booking-state/:flightInstanceId` - Clear booking state

## Implementation Details

### Files Changed

- `src/api-gateway/modules/booking-state/booking-state.controller.ts`
- `src/api-gateway/modules/booking-state/dto/save-cabin-selection.dto.ts`
- `src/shared/services/booking-state.service.ts`
- `src/shared/repositories/booking-state.repository.ts`

### Validation Logic

```typescript
// Economy fare classes must start with 'Y'
if (cabinType === 'economy' && !fareClassCode.startsWith('Y')) {
  throw new InvalidFareClassException(fareClassCode, cabinType);
}

// Business fare classes must start with 'J'
if (cabinType === 'business' && !fareClassCode.startsWith('J')) {
  throw new InvalidFareClassException(fareClassCode, cabinType);
}
```

## Changelog

- **2025-11-25**: Added fare class validation to ensure data integrity
- **2025-11-25**: Integrated with seat map API for auto-fetch cabinType

