# API Documentation Changelog

## [2025-11-25] - Booking State & Seat Map Improvements

### New Features

#### 1. POST /api/v1/booking-state/cabin - Fare Class Validation

**Added**: Fare class code validation to ensure data integrity

**Validation Rules**:
- **Economy**: `fareClassCode` must start with `'Y'` (e.g., `'YS'`, `'YF'`, `'YSM'`)
- **Business**: `fareClassCode` must start with `'J'` (e.g., `'JS'`, `'JF'`, `'JFLX'`)

**Error Response**:
```json
{
  "statusCode": 400,
  "message": "Invalid fare class code 'JS' for cabin type 'economy'. Economy fare classes must start with 'Y'.",
  "error": "Bad Request"
}
```

**Related Documentation**: See `docs/api/BOOKING_STATE_CABIN_API.md`

#### 2. GET /api/v1/search/seats - Auto-fetch Cabin Type

**Added**: Optional auto-fetch `cabinType` from booking state

**Behavior**:
- If user is authenticated and has saved cabin selection → Auto-fetch `cabinType` from Redis
- Query parameter `cabinType` has highest priority (override booking state)
- If no token and no `cabinType` → Returns 400 Bad Request

**Request Examples**:
```http
# Auto-fetch (with token, no cabinType in query)
GET /api/v1/search/seats?flightInstanceId=xxx
Authorization: Bearer <token>

# Explicit (override booking state)
GET /api/v1/search/seats?flightInstanceId=xxx&cabinType=business
Authorization: Bearer <token>

# Without token (must provide cabinType)
GET /api/v1/search/seats?flightInstanceId=xxx&cabinType=economy
```

**Related Documentation**: See `docs/api/SEAT_MAP_AUTO_FETCH.md`

### Implementation Details

#### OptionalJwtAuthGuard

**New Guard**: `src/api-gateway/modules/auth/guard/optional-jwt-auth.guard.ts`

**Purpose**: Allow optional authentication for APIs that can work with or without token

**Behavior**:
- Extract `userId` from JWT token if present
- Do not block request if token is missing
- Set `req.user = null` if no token

**Usage**:
```typescript
@UseGuards(OptionalJwtAuthGuard)
@Get('seats')
async getSeatMap(@Req() req: Request & { user?: { userId: string } }) {
  // req.user may be undefined if no token
}
```

### Updated Endpoints

#### GET /api/v1/search/fare-options

**Updated**: Now supports auto-fetch `flightInstanceId` and `cabinType` from booking state

**Behavior**: Similar to seat map API - auto-fetches from booking state if user is authenticated

### Scripts & Tools

#### download-deals-images.ts

**Updated**:
- Auto-cleanup old images before download
- Limit to top 8 deals only
- API Gateway health check with retry logic

**Related Documentation**: See `docs/setup/DEALS_IMAGES_AND_SEED_IMPROVEMENTS.md`

#### seed-if-empty.ts

**New Script**: Conditional seeding that checks for existing data before seeding

**Related Documentation**: See `docs/setup/DEALS_IMAGES_AND_SEED_IMPROVEMENTS.md`

### Breaking Changes

None - All changes are backward compatible.

### Migration Guide

No migration required. Existing API calls will continue to work. New features are optional enhancements.
