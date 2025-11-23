# Get Seat Map API - Giải thích chi tiết

## Tổng quan

API `GET /api/v1/search/seats` trả về bản đồ ghế ngồi (seat map) cho một chuyến bay cụ thể, được lọc theo cabin type (economy hoặc business).

## Endpoint

```
GET /api/v1/search/seats?flightInstanceId={uuid}&cabinType={economy|business}
```

## Input Parameters

- **`flightInstanceId`** (bắt buộc, UUID v7): ID của chuyến bay cụ thể
- **`cabinType`** (bắt buộc, enum): `economy` hoặc `business`

## Flow xử lý (Step-by-Step)

### 1. **API Gateway Layer** (`src/api-gateway/modules/search/search.controller.ts`)

```typescript
@Get('seats')
async getSeatMap(@Query() query: GetSeatMapDto): Promise<SeatMapResponseDto>
```

- Validate input: `flightInstanceId` phải là UUID v7, `cabinType` phải là `economy` hoặc `business`
- Gửi message đến Search Microservice qua TCP: `SEARCH_MS.PATTERN.GET_SEAT_MAP`

### 2. **Search Microservice** (`src/microservices/search/search.service.ts`)

#### Step 2.1: Lấy Flight Instance
```sql
SELECT fi.*, aircraft.*, aircraft_type.*
FROM FlightInstances fi
LEFT JOIN Aircrafts aircraft ON fi.aircraft_id = aircraft.aircraft_id
LEFT JOIN AircraftTypes aircraft_type ON aircraft.aircraft_type_id = aircraft_type.aircraft_type_id
WHERE fi.flight_instance_id = :flightInstanceId
```

- Validate flight instance tồn tại
- Validate flight instance có aircraft và aircraft type được assign

#### Step 2.2: Map Cabin Type → Cabin Class Codes

```typescript
CABIN_TYPE_MAP = {
  'economy': ['Y'],    // Economy → Cabin Class Code 'Y'
  'business': ['J'],   // Business → Cabin Class Code 'J'
  'first': ['F']       // First → Cabin Class Code 'F'
}
```

- `cabinType = 'economy'` → `cabinClassCodes = ['Y']`
- `cabinType = 'business'` → `cabinClassCodes = ['J']`

#### Step 2.3: Query Seats từ Database

```sql
SELECT 
  seat.*,
  config.*,
  cabin.*
FROM FlightSeats seat
INNER JOIN SeatConfigurations config ON seat.seat_config_id = config.seat_config_id
INNER JOIN CabinClasses cabin ON config.cabin_class_code = cabin.cabin_class_code
WHERE 
  seat.flight_instance_id = :flightInstanceId
  AND cabin.cabin_class_code IN (:cabinClassCodes)  -- ['Y'] hoặc ['J']
  AND config.aircraft_type_id = :aircraftTypeId
ORDER BY seat.seat_number ASC
```

**Giải thích:**
- `FlightSeats`: Bảng chứa tất cả ghế của một chuyến bay cụ thể
  - Mỗi flight instance có nhiều seats (ví dụ: 180 seats cho A321)
  - Mỗi seat có: `flight_seat_id`, `seat_number`, `is_available`
- `SeatConfigurations`: Bảng định nghĩa layout ghế theo loại máy bay
  - Ví dụ: A321 có seats 1A-30F (180 seats)
  - Mỗi seat config có: `seat_number`, `cabin_class_code` (Y/J), `seat_type` (window/aisle/middle), `is_exit_row`
- `CabinClasses`: Bảng định nghĩa cabin classes (Y = Economy, J = Business)

**Query này trả về:**
- Tất cả seats của flight instance
- Filter theo cabin class (chỉ lấy Economy hoặc Business)
- Filter theo aircraft type (đảm bảo seat config đúng với loại máy bay)

#### Step 2.4: Lấy Fare Classes (để map note codes)

```sql
SELECT fare.*, cabin.*
FROM FareClasses fare
INNER JOIN CabinClasses cabin ON fare.cabin_class_code = cabin.cabin_class_code
WHERE cabin.cabin_class_code IN (:cabinClassCodes)
```

- Lấy tất cả fare classes thuộc cabin type (ví dụ: YS, YF, Y cho Economy)
- Dùng để map note codes (ef, es, em cho Economy; bf, bs cho Business)

#### Step 2.5: Process và Group Seats

**a) Determine Seat Position (left/right):**

```typescript
determineSeatPosition(seatNumber: string, cabinType: CabinType): 'left' | 'right'
```

- **Business (2-2 config)**: A-B = left, C-D = right
- **Economy (3-3 config)**: A-B-C = left, D-E-F = right

Ví dụ:
- `1A`, `1B`, `1C` → `left` (Economy)
- `1D`, `1E`, `1F` → `right` (Economy)
- `1A`, `1B` → `left` (Business)
- `1C`, `1D` → `right` (Business)

**b) Map Fare Class Note Codes:**

```typescript
getFareClassNote(fareClassCode: string, cabinType: CabinType): string
```

- **Business**: `JF` → `bf` (Business Flex), default → `bs` (Business Smart)
- **Economy**: `YF` → `ef` (Economy Flex), `YS` → `es` (Economy Smart), `YSM` → `em` (Economy Saver Max)

**c) Group Seats by Cabin Class:**

- Group tất cả seats theo `cabin_class_code`
- Tạo `SeatMapGroupDto[]` với:
  - `id`: `'business'` hoặc `'economy'`
  - `list`: Array of `SeatDto[]`

#### Step 2.6: Build Response

```typescript
{
  flightInstanceId: string,
  flightNumber: string,
  cabinType: 'economy' | 'business',
  seats: [
    {
      id: 'economy' | 'business',
      list: [
        {
          flightSeatId: string,      // UUID v7 - dùng để tạo reservation
          seatNumber: string,         // '1A', '10B', '12F'
          cabinClassCode: string,     // 'Y' hoặc 'J'
          seatType: string | null,    // 'window', 'aisle', 'middle'
          isExitRow: boolean,         // true nếu là exit row
          position: 'left' | 'right', // Vị trí trên máy bay
          isAvailable: boolean,       // Ghế còn trống không
          note: string | null         // 'ef', 'es', 'em', 'bf', 'bs'
        },
        ...
      ]
    }
  ]
}
```

## Database Schema

### FlightSeats Table
```
flight_seat_id (PK, UUID v7)
flight_instance_id (FK → FlightInstances)
seat_config_id (FK → SeatConfigurations)
seat_number (VARCHAR) - '1A', '10B', '12F'
is_available (BIT) - true/false
```

### SeatConfigurations Table
```
seat_config_id (PK, UUID v7)
aircraft_type_id (FK → AircraftTypes)
seat_number (VARCHAR) - '1A', '10B', '12F'
cabin_class_code (FK → CabinClasses) - 'Y' hoặc 'J'
seat_type (VARCHAR) - 'window', 'aisle', 'middle'
is_exit_row (BIT) - true/false
```

### CabinClasses Table
```
cabin_class_code (PK) - 'Y', 'J', 'F'
name (NVARCHAR) - 'Economy', 'Business', 'First'
```

## Ví dụ Response

### Request
```
GET /api/v1/search/seats?flightInstanceId=019a8f4a-bb0e-7402-a0c4-27647b89dc71&cabinType=economy
```

### Response
```json
{
  "flightInstanceId": "019a8f4a-bb0e-7402-a0c4-27647b89dc71",
  "flightNumber": "VN123",
  "cabinType": "economy",
  "seats": [
    {
      "id": "economy",
      "list": [
        {
          "flightSeatId": "019a8f4a-bb0e-7402-a0c4-27647b89dc72",
          "seatNumber": "1A",
          "cabinClassCode": "Y",
          "seatType": "window",
          "isExitRow": false,
          "position": "left",
          "isAvailable": true,
          "note": "es"
        },
        {
          "flightSeatId": "019a8f4a-bb0e-7402-a0c4-27647b89dc73",
          "seatNumber": "1B",
          "cabinClassCode": "Y",
          "seatType": "middle",
          "isExitRow": false,
          "position": "left",
          "isAvailable": true,
          "note": "es"
        },
        {
          "flightSeatId": "019a8f4a-bb0e-7402-a0c4-27647b89dc74",
          "seatNumber": "1C",
          "cabinClassCode": "Y",
          "seatType": "aisle",
          "isExitRow": false,
          "position": "left",
          "isAvailable": false,
          "note": "es"
        },
        {
          "flightSeatId": "019a8f4a-bb0e-7402-a0c4-27647b89dc75",
          "seatNumber": "1D",
          "cabinClassCode": "Y",
          "seatType": "aisle",
          "isExitRow": false,
          "position": "right",
          "isAvailable": true,
          "note": "es"
        },
        {
          "flightSeatId": "019a8f4a-bb0e-7402-a0c4-27647b89dc76",
          "seatNumber": "1E",
          "cabinClassCode": "Y",
          "seatType": "middle",
          "isExitRow": false,
          "position": "right",
          "isAvailable": true,
          "note": "es"
        },
        {
          "flightSeatId": "019a8f4a-bb0e-7402-a0c4-27647b89dc77",
          "seatNumber": "1F",
          "cabinClassCode": "Y",
          "seatType": "window",
          "isExitRow": false,
          "position": "right",
          "isAvailable": true,
          "note": "es"
        }
        // ... more seats
      ]
    }
  ]
}
```

## Cách sử dụng trong Booking Flow

### Flow hoàn chỉnh (Best Practice - Backend tự quản lý state):

**Nguyên tắc:** Backend tự quản lý toàn bộ state trong Redis. Frontend chỉ cần gọi API để lưu và fetch state, không cần lưu state ở client-side.

1. **Search Flights** → `GET /api/v1/search/flights`
   - User chọn chuyến bay → Lấy `flightInstanceId`
   - **Frontend**: Chỉ hiển thị kết quả, không lưu state

2. **Get Fare Options** → `GET /api/v1/search/fare-options?flightInstanceId=xxx&cabinType=economy`
   - User xem các loại vé (Saver Max, Standard, Smart, Flex)
   - User chọn loại vé → Lấy `fareClassCode` (ví dụ: `YS`)
   - **Frontend**: Chỉ hiển thị options, không lưu state

3. **Save Cabin Selection** → `POST /api/v1/booking-state/cabin`
   - **Backend tự quản lý**: Lưu `{flightInstanceId, cabinType, fareClassCode}` vào Redis
   - **Key format**: `booking:state:{userId}:{flightInstanceId}`
   - **TTL**: 30 phút (dài hơn reservation TTL 15 phút)
   - **Frontend**: Chỉ gọi API, không cần lưu state ở client

4. **Get Seat Map** → `GET /api/v1/search/seats?flightInstanceId=xxx&cabinType=economy`
   - **Mục đích**: Hiển thị bản đồ ghế cho user chọn
   - **Response**: Danh sách tất cả ghế với `isAvailable`, `seatType`, `position`
   - **Frontend**: Render seat map UI (grid layout với left/right, window/aisle/middle)
   - **Lưu ý**: Chỉ hiển thị, không lưu state ở client

5. **User chọn ghế** → Lấy `flightSeatId` và `seatNumber` từ response
   - **Frontend**: Chỉ hiển thị selection, không lưu state

6. **Save Seat Selection** → `POST /api/v1/booking-state/seat`
   - **Backend tự quản lý**: Lưu `{flightInstanceId, flightSeatId, seatNumber}` vào Redis
   - **Validation**: Backend tự động validate cabin đã được chọn trước
   - **Key format**: Cùng key với cabin selection (update state hiện có)
   - **Frontend**: Chỉ gọi API, không cần lưu state ở client

7. **Get Booking State (Optional - Recommended)** → `GET /api/v1/booking-state/:flightInstanceId`
   - **Mục đích**: Verify state trước khi tạo reservation (best practice)
   - **Response**: `{ flightInstanceId, cabin, seat, updatedAt }`
   - **Frontend**: Hiển thị summary để user confirm trước khi tạo reservation
   - **Lưu ý**: Step này optional nhưng recommended để đảm bảo state đầy đủ

8. **Create Reservation** → `POST /api/v1/reservations`
   - **Backend tự động**:
     - Lấy `cabinSelection` và `seatSelection` từ Redis (không cần gửi trong request body)
     - Validate cabin và seat đã được chọn
     - Tạo reservation với `fareClassCode` và `flightSeatId` từ booking state
     - Mark seat as unavailable (`is_available = false`)
     - **Tự động clear booking state** sau khi tạo reservation thành công
   - **Request body**: Chỉ cần `segments` (với `flightInstanceId` và `segmentType`), không cần `fareClassCode` hay `flightSeatId`
   - **Frontend**: Chỉ gửi segments, backend tự động lấy cabin/seat từ Redis

### Flow với Error Handling:

**Nếu cabin chưa được chọn:**
- `POST /booking-state/seat` → 400 Bad Request: "Cabin not selected for flight {flightInstanceId}. Please select cabin first."

**Nếu seat chưa được chọn:**
- `POST /reservations` → 400 Bad Request: "Seat not selected for flight {flightInstanceId}. Please select seat after cabin selection."

**Nếu booking state expired (TTL 30 phút):**
- `GET /booking-state/:flightInstanceId` → 404 Not Found
- `POST /reservations` → 400 Bad Request: "No booking state found for flight {flightInstanceId}. Please select cabin and seat first."

### Best Practices đã áp dụng:

✅ **Backend tự quản lý state hoàn toàn**
- State được lưu trong Redis, không phụ thuộc vào frontend
- Frontend chỉ cần gọi API, không cần lưu state ở client-side

✅ **Stateless Frontend**
- Frontend không cần lưu cabin/seat selection trong localStorage/sessionStorage
- Mọi state đều được quản lý bởi backend

✅ **TTL-based Expiration**
- State tự động expire sau 30 phút
- Đảm bảo không có stale state

✅ **Validation và Error Handling**
- Backend tự động validate cabin phải được chọn trước seat
- Backend tự động validate seat phải được chọn trước reservation
- Error messages rõ ràng, hướng dẫn user next steps

✅ **Automatic Cleanup**
- State tự động được clear sau khi tạo reservation thành công
- Tránh memory leak và stale data

✅ **Idempotency**
- Có thể gọi `POST /booking-state/cabin` hoặc `POST /booking-state/seat` nhiều lần
- State sẽ được update, không tạo duplicate

### Optional: Clear Booking State

Nếu user muốn bắt đầu lại từ đầu (ví dụ: chọn lại cabin hoặc seat):

**Clear Booking State** → `DELETE /api/v1/booking-state/:flightInstanceId` (nếu implement)
- Xóa toàn bộ booking state cho flight instance
- User có thể bắt đầu lại flow từ step 3 (Save Cabin Selection)

## Lưu ý quan trọng

### 1. **Seat Availability**
- `isAvailable = true`: Ghế còn trống, user có thể chọn
- `isAvailable = false`: Ghế đã được giữ (reserved) hoặc đã được book
- Khi tạo reservation với `flightSeatId`, backend tự động set `is_available = false`
- Khi cancel reservation, backend tự động set `is_available = true`

### 2. **Cabin Type Filtering**
- API chỉ trả về seats thuộc cabin type được request
- Nếu request `cabinType=economy`, chỉ trả về seats có `cabin_class_code = 'Y'`
- Nếu request `cabinType=business`, chỉ trả về seats có `cabin_class_code = 'J'`

### 3. **Seat Number Format**
- Format: `{row}{column}` (ví dụ: `1A`, `10B`, `12F`)
- Columns: A, B, C, D, E, F (6 cột mỗi hàng)
- Rows: 1, 2, 3, ... (tùy theo loại máy bay)

### 4. **Seat Type**
- **Window**: Ghế cửa sổ (A, F)
- **Aisle**: Ghế lối đi (C, D)
- **Middle**: Ghế giữa (B, E)

### 5. **Position (left/right)**
- Dùng để render UI: hiển thị ghế bên trái và bên phải
- **Economy**: A-B-C = left, D-E-F = right
- **Business**: A-B = left, C-D = right

### 6. **Note Codes**
- Dùng để hiển thị icon/color trên UI
- `ef` = Economy Flex (có thể đổi/hủy)
- `es` = Economy Smart (hạn chế đổi/hủy)
- `em` = Economy Saver Max (không đổi/hủy)
- `bf` = Business Flex
- `bs` = Business Smart

## Error Cases

1. **404 Not Found**: Flight instance không tồn tại
2. **400 Bad Request**: 
   - `flightInstanceId` không phải UUID v7
   - `cabinType` không phải `economy` hoặc `business`
   - Flight instance không có aircraft assigned
3. **503 Service Unavailable**: Search microservice không chạy

## Performance Considerations

- Query sử dụng JOIN để lấy tất cả thông tin trong 1 query (efficient)
- Filter theo `cabin_class_code` để giảm số lượng seats trả về
- Order by `seat_number` để frontend dễ render theo thứ tự

## Frontend Usage Example

```javascript
// 1. Get seat map
const response = await fetch(
  `/api/v1/search/seats?flightInstanceId=${flightInstanceId}&cabinType=economy`
);
const seatMap = await response.json();

// 2. Render seat map
seatMap.seats[0].list.forEach(seat => {
  // Render seat based on:
  // - seat.seatNumber (1A, 1B, 1C...)
  // - seat.position (left/right)
  // - seat.isAvailable (enable/disable selection)
  // - seat.seatType (window/aisle/middle - for icon)
  // - seat.isExitRow (highlight exit row)
});

// 3. User clicks on seat
const selectedSeat = {
  flightSeatId: seat.flightSeatId,
  seatNumber: seat.seatNumber
};

// 4. Save seat selection
await fetch('/api/v1/booking-state/seat', {
  method: 'POST',
  body: JSON.stringify({
    flightInstanceId: flightInstanceId,
    flightSeatId: selectedSeat.flightSeatId,
    seatNumber: selectedSeat.seatNumber
  })
});
```

