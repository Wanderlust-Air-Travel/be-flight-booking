# API Documentation Changelog

## [2025-12-03] - Dynamic Pricing & Management APIs

### Tính năng mới

#### 1. Route Fare Price Management APIs

**Feature**: Quản lý giá vé động theo route, fare class, và cabin type từ database

**New Endpoints**:
- `POST /api/v1/admin/route-fare-prices` - Create route fare price (Requires ADMIN, REVENUE_ANALYST)
- `GET /api/v1/admin/route-fare-prices` - Get all route fare prices
- `GET /api/v1/admin/route-fare-prices/:id` - Get route fare price by ID
- `PUT /api/v1/admin/route-fare-prices/:id` - Update route fare price
- `DELETE /api/v1/admin/route-fare-prices/:id` - Delete route fare price

**Key Features**:
- Dynamic pricing với effective dates (effectiveFrom, effectiveTo)
- Priority system cho promotions và special pricing
- Tax rate và fee rate configurable per route/fare class
- Fallback pricing logic nếu không tìm thấy trong database

**Required Roles**:
- **CRUD**: `ADMIN`, `REVENUE_ANALYST`
- **Read Only**: `DISTRIBUTION_MANAGER`

#### 2. Baggage Allowance Management APIs

**Feature**: Quản lý quy định hành lý theo fare class và route type (domestic/international)

**New Endpoints**:
- `POST /api/v1/admin/baggage-allowances` - Create baggage allowance (Requires ADMIN, ANCILLARY_MANAGER)
- `GET /api/v1/admin/baggage-allowances` - Get all baggage allowances
- `GET /api/v1/admin/baggage-allowances/:id` - Get baggage allowance by ID
- `PUT /api/v1/admin/baggage-allowances/:id` - Update baggage allowance
- `DELETE /api/v1/admin/baggage-allowances/:id` - Delete baggage allowance

**Key Features**:
- Checked baggage: weight (kg) và pieces
- Carry-on baggage: weight (kg), pieces, và dimensions
- Phân biệt domestic và international routes
- Notes field cho additional restrictions

**Required Roles**:
- **CRUD**: `ADMIN`, `ANCILLARY_MANAGER`
- **Read Only**: `CALL_CENTER`, `DISTRIBUTION_MANAGER`

#### 3. Cabin Service Management APIs

**Feature**: Quản lý dịch vụ cabin (meals, entertainment, WiFi, priority boarding, lounge access, etc.)

**New Endpoints**:
- `POST /api/v1/admin/cabin-services` - Create cabin service (Requires ADMIN, ANCILLARY_MANAGER)
- `GET /api/v1/admin/cabin-services` - Get all cabin services
- `GET /api/v1/admin/cabin-services/:id` - Get cabin service by ID
- `PUT /api/v1/admin/cabin-services/:id` - Update cabin service
- `DELETE /api/v1/admin/cabin-services/:id` - Delete cabin service

**Key Features**:
- Services có thể áp dụng cho cabin class hoặc fare class cụ thể
- Included services (miễn phí) vs purchasable services (có giá)
- Service types: meal, entertainment, wifi, priority_boarding, lounge_access, seat_selection, extra_legroom, other
- Display order để sắp xếp trong UI
- Icon URL cho visual representation

**Required Roles**:
- **CRUD**: `ADMIN`, `ANCILLARY_MANAGER`
- **Read Only**: `CALL_CENTER`, `DISTRIBUTION_MANAGER`

#### 4. Frontend UI Implementation

**New Admin Pages**:
- `/admin/route-fare-prices` - Quản lý giá vé theo route
- `/admin/baggage-allowances` - Quản lý quy định hành lý
- `/admin/cabin-services` - Quản lý dịch vụ cabin

**Best Practices Applied**:
- Type definitions tách riêng khỏi business logic
- Consistent UI/UX với các admin pages khác
- Form validation và error handling
- Real-time updates sau CRUD operations

**Documentation Updates**:
- Updated `docs/api/API_DOCS.md` với Route Fare Price, Baggage Allowance, Cabin Service APIs
- Updated `docs/CHANGELOG.md` với Dynamic Pricing & Management APIs entry
- Updated `docs/STRUCTURE.md` với Admin module endpoints
- Updated Postman collection với new admin API requests
- Updated `docs/database/ERD.md` với RouteFarePrices, BaggageAllowances, CabinServices entities

---

## [2025-12-03] - Role-Based Access Control (RBAC) & Admin APIs

### Tính năng mới

#### 1. Role-Based Access Control (RBAC) System

**Feature**: Triển khai hệ thống phân quyền dựa trên vai trò (Role-Based Access Control) theo best practices của ngành hàng không

**Roles**: 10 roles chuyên nghiệp được chia thành 3 nhóm:
- **Người dùng Cuối**: `CUSTOMER`, `TRAVEL_AGENT`
- **Nghiệp vụ Cốt lõi**: `SCHEDULE_PLANNER`, `REVENUE_ANALYST`, `ANCILLARY_MANAGER`, `CALL_CENTER`
- **Hỗ trợ & Quản trị**: `ADMIN`, `ACCOUNTING_STAFF`, `DISTRIBUTION_MANAGER`, `FRAUD_ANALYST`

**Authorization**:
- Tất cả Admin APIs yêu cầu JWT authentication
- Mỗi endpoint được bảo vệ bởi `@Roles()` decorator
- Nếu user không có quyền, sẽ nhận `403 Forbidden` với message: "Access denied. Required roles: {roles}"

**Xem chi tiết**: [ROLES_AND_PERMISSIONS.md](../ROLES_AND_PERMISSIONS.md)

#### 2. Admin APIs - Fare Management

**New Endpoints**:
- `POST /api/v1/admin/fare-classes` - Create fare class (Requires ADMIN, REVENUE_ANALYST)
- `GET /api/v1/admin/fare-classes` - Get all fare classes
- `GET /api/v1/admin/fare-classes/:code` - Get fare class by code
- `PUT /api/v1/admin/fare-classes/:code` - Update fare class
- `DELETE /api/v1/admin/fare-classes/:code` - Delete fare class

#### 3. Admin APIs - Flight Schedule Management

**New Endpoints**:
- `POST /api/v1/admin/flight-schedules` - Create flight schedule (Requires ADMIN, SCHEDULE_PLANNER)
- `GET /api/v1/admin/flight-schedules` - Get all flight schedules
- `GET /api/v1/admin/flight-schedules/:id` - Get flight schedule by ID
- `PUT /api/v1/admin/flight-schedules/:id` - Update flight schedule
- `DELETE /api/v1/admin/flight-schedules/:id` - Delete flight schedule

#### 4. Admin APIs - Flight Instance Management

**New Endpoints**:
- `POST /api/v1/admin/flight-instances` - Create flight instance (Requires ADMIN, SCHEDULE_PLANNER)
- `GET /api/v1/admin/flight-instances` - Get all flight instances
- `GET /api/v1/admin/flight-instances/:id` - Get flight instance by ID
- `PUT /api/v1/admin/flight-instances/:id` - Update flight instance
- `DELETE /api/v1/admin/flight-instances/:id` - Delete flight instance

#### 5. Admin APIs - User Role Management

**New Endpoints**:
- `POST /api/v1/admin/users/:userId/roles` - Assign role to user (Requires ADMIN only)
- `DELETE /api/v1/admin/users/:userId/roles/:roleCode` - Remove role from user (Requires ADMIN only)
- `GET /api/v1/admin/users/:userId/roles` - Get user roles (Requires ADMIN only)
- `GET /api/v1/admin/roles` - Get all roles (Requires ADMIN only)

**Documentation Updates**:
- Updated `docs/api/API_DOCS.md` với Admin APIs section
- Updated `docs/ROLES_AND_PERMISSIONS.md` với chi tiết về tất cả roles và permissions
- Updated Postman collection với Admin APIs requests
- Updated `docs/STRUCTURE.md` với Admin module information
- Updated `docs/CHANGELOG.md` với RBAC system entry

---

## [2025-12-01] - Hybrid Cancellation Approach (Partial & Full Cancellation)

### Tính năng mới

#### 1. Hybrid Cancellation Approach (2025-12-01)

**Feature**: Hỗ trợ hủy từng ticket riêng lẻ (partial cancellation) và hủy toàn bộ booking (full cancellation)

**New Endpoints**:
- `GET /api/v1/bookings/tickets/:ticketId/info` - Get ticket info (bookingId, bookingStatus)
- `PATCH /api/v1/bookings/tickets/:ticketId/cancel` - Cancel individual ticket
- `POST /api/v1/auth/otp/cancellation/send` - Send OTP for cancellation verification
- `POST /api/v1/auth/otp/cancellation/verify` - Verify OTP and create verification token

**Enhanced Endpoints**:
- `PATCH /api/v1/bookings/:id/cancel` - Enhanced với paid booking support và refund calculation

**Key Features**:
- **Level 1: Cancel Individual Ticket** - Hủy từng ticket riêng lẻ
  - Recalculate `booking.total_amount` sau khi hủy ticket
  - Auto-cancel booking nếu tất cả tickets cancelled
  - Refund calculation theo segment (proportional)
- **Level 2: Cancel Entire Booking** - Hủy toàn bộ booking
  - Refund calculation cho toàn bộ booking
  - Cancel tất cả tickets và segments
- **OTP Verification for Paid Bookings**:
  - OTP expiry: 5 minutes
  - Verification token expiry: 10 minutes
  - One-time use OTP (deleted after verification)
- **Refund Calculation**:
  - Full cancellation: `Refund = Total Amount - Cancellation Fee - Non-refundable Fees (10%)`
  - Partial cancellation: `Refund = Segment Amount - Cancellation Fee - Non-refundable Fees (proportional 10%)`
  - Cancellation fee: 300,000 - 600,000 VND per segment (based on fare class)

**Business Rules**:
- Paid bookings có thể hủy (với OTP verification)
- Pending/Confirmed bookings có thể hủy trực tiếp (không cần OTP)
- Auto-cancel booking khi tất cả tickets cancelled
- Booking status check được ưu tiên trước fare class/time limit check

**My Journey Filter**:
- Tự động loại bỏ cancelled bookings khỏi "Hành trình của tôi"
- Chỉ hiển thị active/completed journeys

**Documentation Updates**:
- Updated `docs/api/API_DOCS.md` với hybrid cancellation endpoints
- Updated `docs/api/API_SEQUENCE_DIAGRAMS.md` với cancellation flows
- Updated Postman collection với cancel ticket requests và OTP cancellation endpoints

---

## [2025-11-26] - Seat Validation, Error Handling & Payment Timeout Fix

### Bug Fixes

#### 1. Payment Microservice Timeout Issues (2025-11-26)

**Fixed**: Payment microservice timeout causing 11/25 tests to fail

**Problem**: 
- Payment operations were timing out after 15 seconds (default timeout)
- Payment operations are more complex than other microservices:
  - Database transactions with pessimistic locks
  - Payment gateway integration (external API calls)
  - Complex validation and business logic

**Solution**:
- Added explicit timeout configuration for payment microservice client:
  - **Write Operations** (createPayment, processPayment, updatePaymentStatus, handleWebhook): **60 seconds timeout**
  - **Read Operations** (getPayment, getPaymentsByBooking): **30 seconds timeout**
- Used RxJS `timeout` operator with proper error handling
- Timeout errors are properly mapped with `ETIMEDOUT` code

**Implementation**:
```typescript
import { timeout, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

// Write operations (60 seconds)
return await firstValueFrom(
  this.client.send(pattern, data).pipe(
    timeout(60000), // 60 seconds
    catchError((error) => {
      if (error.name === 'TimeoutError') {
        const timeoutError: any = new Error('Payment microservice request timeout...');
        timeoutError.code = 'ETIMEDOUT';
        return throwError(() => timeoutError);
      }
      return throwError(() => error);
    }),
  ),
);

// Read operations (30 seconds)
return await firstValueFrom(
  this.client.send(pattern, data).pipe(
    timeout(30000), // 30 seconds
    // ... error handling
  ),
);
```

**Results**: All 25/25 payment tests now passing (100% pass rate)

**Files Changed**:
- `src/api-gateway/modules/payment/payment.controller.ts` - Added timeout operators

---

## [2025-11-26] - Seat Validation & Error Handling Improvements

### New Features

#### 1. POST /api/v1/booking-state/seat - Comprehensive Seat Validation

**Added**: Comprehensive seat validation before saving to booking state

**Validation Rules**:
1. **Cabin Selection Required**: Cabin must be selected before selecting seat
2. **Flight Instance Validation**: Flight instance must exist in database
3. **Seat Existence**: Seat must exist with provided `flightSeatId`
4. **Seat-Flight Match**: Seat must belong to the specified flight instance
5. **Seat Number Match**: Seat number must match the seat ID
6. **Seat Availability**: Seat must be available (`is_available = true`)
7. **Cabin Class Match**: Seat must belong to the selected cabin class (Economy/Business) - **MOST IMPORTANT**

**Error Responses**:
```json
{
  "statusCode": 400,
  "message": "Seat 10A is in Business class, but you selected Economy class. Please select a seat from the correct cabin.",
  "error": "Bad Request"
}
```

**Related Documentation**: See `docs/api/BOOKING_STATE_SEAT_API.md`

### Improvements

#### 1. Error Handling Improvements

**Reservation Controller**:
- Improved error handling to preserve error messages from microservice
- Handle multiple error formats (HttpException, statusCode, response.message)
- Provide descriptive default messages with keywords (cabin|seat|booking state)

**Payment Controller**:
- Improved error message extraction from microservice errors
- Try multiple error formats to extract meaningful messages

**Best Practice**: Infrastructure errors (503) vs Business logic errors (400/404)

### Updated Endpoints

#### POST /api/v1/booking-state/seat

**Updated**: Now includes comprehensive validation before saving to booking state

**Validation Flow**:
1. Check cabin selection exists
2. Validate flight instance exists
3. Validate seat exists
4. Validate seat belongs to correct flight instance
5. Validate seat number matches
6. Validate seat is available
7. Validate seat matches cabin class from booking state

### Implementation Details

#### Seat Validation Logic

**Location**: `src/api-gateway/modules/booking-state/booking-state.controller.ts`

**Method**: `validateSeatSelection()`

**Dependencies**:
- `TypeOrmModule.forFeature([FlightSeat, FlightInstance, FareClass])` - Added to booking-state module for database validation

**Best Practices Applied**:
1. **Early Validation** - Validate before saving (fail fast principle)
2. **Database-First Validation** - Query database to validate seat properties
3. **Clear Error Messages** - Specific error messages for each validation failure
4. **TypeORM Relations** - Load relations efficiently to validate cabin class match

### Breaking Changes

None - All changes are backward compatible. Validation errors return 400 Bad Request with clear messages.

### Migration Guide

No migration required. Existing API calls will continue to work. New validation provides better error messages and data integrity.

---

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
