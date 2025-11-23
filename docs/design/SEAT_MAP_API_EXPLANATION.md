# Get Seat Map API - Giải thích chi tiết

## Flow hoàn chỉnh (Best Practice - Tối ưu cho Production)

**Nguyên tắc:** Backend tự quản lý toàn bộ persistent state trong Redis. Frontend dùng component state cho UI flow, backend state cho recovery sau reload.

### Mục đích của việc lưu Cabin Selection vào Redis (Bước 3):

1. **Backend tự động lấy khi tạo Reservation**: Khi user tạo reservation, backend tự động lấy `cabinType` và `fareClassCode` từ Redis - frontend không cần gửi lại trong request body
2. **Backend tự động lấy khi Get Seat Map**: Nếu user không truyền `cabinType`, backend tự động lấy từ Redis (giảm số lượng parameters)
3. **Recovery sau reload page**: Nếu user reload page, frontend có thể lấy lại state từ backend thay vì mất hết data
4. **Validation**: Backend validate cabin đã được chọn trước khi cho phép chọn seat
5. **Multi-tab support**: User có thể mở nhiều tab, state được sync qua backend

### State Management Strategy (Best Practice - Multi-page Navigation):

- **URL Params (Primary - Best Practice)**: Cách chính để truyền data giữa các trang
  - Mỗi trang lấy `flightInstanceId` từ URL params
  - Example: `/booking/fare-options?flightInstanceId=xxx` → `/booking/seat-map?flightInstanceId=xxx`
  - **Lợi ích**: 
    - Shareable URLs (user có thể bookmark, share link)
    - Browser back/forward buttons hoạt động đúng
    - Reload page không mất data (đọc từ URL)
    - SEO friendly
- **Component State (useState)**: Dùng cho UI state của trang hiện tại (temporary)
  - Lưu `cabinType`, `fareClassCode`, `selectedSeat` trong component state của trang hiện tại
  - Chỉ dùng trong cùng một trang, không dùng để truyền giữa các trang
- **Backend State (Redis)**: Dùng cho persistent state và validation (source of truth)
  - Lưu sau khi user chọn cabin/seat
  - TTL 30 phút (tự động expire)
  - **Mục đích**: 
    - Backend tự động lấy khi tạo reservation
    - Backend tự động lấy khi get seat map (nếu không truyền cabinType)
    - Validation: Backend validate cabin/seat đã chọn

### Flow chi tiết (Multi-page Navigation - Best Practice):

**Nguyên tắc**: Mỗi bước là một trang riêng. **URL params là cách chính để truyền data giữa các trang**. Component state chỉ dùng cho UI của trang hiện tại.

1. **Trang 1: Search Flights** → `GET /api/v1/search/flights`
   - User chọn chuyến bay → Lấy `flightInstanceId`
   - **Frontend (Trang Search)**: 
     - Lưu `flightInstanceId` trong **component state** (useState) của trang Search (cho UI)
     - **Bắt buộc**: Khi user chọn flight, **navigate** và truyền `flightInstanceId` qua URL: 
       ```typescript
       router.push(`/booking/fare-options?flightInstanceId=${flightInstanceId}`);
       ```
     - **KHÔNG cần lưu vào session/localStorage** 

2. **Trang 2: Fare Options** → `GET /api/v1/search/fare-options?flightInstanceId=xxx&cabinType=economy` (cả 2 đều optional)
   - **Frontend (Trang Fare Options)**: 
     - **Lấy flightInstanceId từ URL params** (vì đã chuyển trang, component state của trang Search đã mất)
       ```typescript
       const flightInstanceId = searchParams.get('flightInstanceId');
       ```
     - User xem các loại vé (Saver Max, Standard, Smart, Flex)
     - User chọn loại vé → Lấy `fareClassCode` (ví dụ: `YS`)
     - Lưu `cabinType` và `fareClassCode` trong **component state** (useState) của trang Fare Options (cho UI)
     - **Gọi API**: Truyền `flightInstanceId` (từ URL params) và `cabinType` (user selection từ UI)
   - **Backend tự quản lý**: 
     - Nếu `flightInstanceId` và `cabinType` không được truyền và user đã đăng nhập, backend tự động lấy từ booking state (nếu đã save cabin selection trước đó)

3. **Save Cabin Selection** → `POST /api/v1/booking-state/cabin`
   - **Mục đích**: Lưu persistent state vào Redis để:
     - Backend tự động lấy khi tạo reservation (không cần frontend gửi lại)
     - Backend tự động lấy khi get seat map (nếu không truyền cabinType)
     - Validation: Backend validate cabin đã chọn trước khi cho phép chọn seat
   - **Backend tự quản lý**: Lưu `{flightInstanceId, cabinType, fareClassCode}` vào Redis
   - **Key format**: `booking:state:{userId}:{flightInstanceId}`
   - **TTL**: 30 phút (dài hơn reservation TTL 15 phút)
   - **Frontend (Trang Fare Options)**: 
     - Gọi API sau khi user chọn fare
     - **Bắt buộc**: Sau khi save thành công, **navigate** và truyền `flightInstanceId` qua URL:
       ```typescript
       router.push(`/booking/seat-map?flightInstanceId=${flightInstanceId}`);
       ```
     - Component state của trang Fare Options sẽ mất khi chuyển trang (không sao, đã lưu vào Redis)

4. **Trang 3: Seat Map** → `GET /api/v1/search/seats?flightInstanceId=xxx` (cabinType optional)
   - **Mục đích**: Hiển thị bản đồ ghế cho user chọn
   - **Frontend (Trang Seat Map)**: 
     - **Lấy flightInstanceId từ URL params** (vì đã chuyển trang, component state của trang Fare Options đã mất)
       ```typescript
       const flightInstanceId = searchParams.get('flightInstanceId');
       ```
     - **Lấy cabinType từ Backend state** (vì đã save ở bước 3):
       ```typescript
       const bookingState = await getBookingState(flightInstanceId);
       const cabinType = bookingState.cabin?.cabinType;
       ```
     - **Gọi get seat map**: 
       - **Option 1 (Recommended)**: Không truyền `cabinType`, backend tự động lấy từ Redis
         ```typescript
         const seats = await getSeatMap(flightInstanceId); // Backend tự lấy cabinType
         ```
       - **Option 2**: Truyền `cabinType` từ backend state (nếu muốn explicit)
         ```typescript
         const seats = await getSeatMap(flightInstanceId, cabinType);
         ```
   - **Backend tự quản lý**: 
     - Nếu `cabinType` không được truyền và user đã đăng nhập, backend tự động lấy `cabinType` từ booking state (nếu đã save cabin selection)
   - **Response**: Danh sách tất cả ghế với `isAvailable`, `seatType`, `position`
   - **Frontend**: Render seat map UI (grid layout với left/right, window/aisle/middle)
   - **Recovery sau reload**: 
     - Đọc `flightInstanceId` từ URL params (luôn có vì đã lưu vào URL)
     - Gọi `GET /api/v1/booking-state/:flightInstanceId` để lấy cabinType
     - Gọi `GET /api/v1/search/seats?flightInstanceId=xxx` (không cần cabinType, backend tự lấy)

5. **User chọn ghế** → Lấy `flightSeatId` và `seatNumber` từ response
   - **Frontend**: 
     - Lưu `flightSeatId` và `seatNumber` trong **component state** (useState) để hiển thị selection
     - **Best Practice**: Lưu `flightInstanceId` vào URL: `/booking/seat-map?flightInstanceId=xxx`

6. **Save Seat Selection** → `POST /api/v1/booking-state/seat`
   - **Mục đích**: Lưu persistent state vào Redis để:
     - Backend tự động lấy khi tạo reservation (không cần frontend gửi lại)
     - Recovery sau reload page (frontend có thể lấy lại state)
     - Validation: Backend validate seat đã chọn trước khi cho phép tạo reservation
   - **Backend tự quản lý**: Lưu `{flightInstanceId, flightSeatId, seatNumber}` vào Redis
   - **Validation**: Backend tự động validate cabin đã được chọn trước
   - **Key format**: Cùng key với cabin selection (update state hiện có)
   - **Frontend**: 
     - Gọi API sau khi user chọn ghế
     - Component state vẫn giữ để dùng trong flow hiện tại (không cần xóa)

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

## Giải thích chi tiết: Tại sao cần lưu Cabin Selection vào Redis?

### Mục đích chính:

1. **Backend tự động lấy khi tạo Reservation** (Quan trọng nhất):
   - Khi user tạo reservation, backend **TỰ ĐỘNG** lấy `cabinType` và `fareClassCode` từ Redis
   - Frontend **KHÔNG CẦN** gửi `fareClassCode` trong request body
   - **Lợi ích**: 
     - Frontend đơn giản hơn (không cần nhớ và gửi lại cabin/seat)
     - Backend là source of truth (tránh mismatch giữa frontend và backend)
     - Security: Frontend không thể thay đổi cabin/seat sau khi đã chọn

2. **Backend tự động lấy khi Get Seat Map**:
   - Nếu user không truyền `cabinType`, backend tự động lấy từ Redis
   - **Lợi ích**: Giảm số lượng parameters, UX tốt hơn

3. **Recovery sau reload page** (Quan trọng cho UX):
   - Nếu user reload page, component state (useState) sẽ mất
   - **Solution**: Frontend gọi `GET /api/v1/booking-state` để lấy lại state từ backend
   - **Lợi ích**: User không mất progress, có thể tiếp tục booking

4. **Validation**:
   - Backend validate cabin đã được chọn trước khi cho phép chọn seat
   - Backend validate seat đã được chọn trước khi cho phép tạo reservation
   - **Lợi ích**: Đảm bảo flow đúng, tránh lỗi business logic

5. **Multi-tab support**:
   - User có thể mở nhiều tab, state được sync qua backend
   - **Lợi ích**: UX tốt hơn, không bị conflict giữa các tab

## Giải quyết vấn đề: Reload page mất data

### Vấn đề:
- Component state (useState) mất khi reload page
- User phải chọn lại từ đầu → UX tệ

### Solution (Best Practice):

**Option 1: URL Params (Recommended)**
```typescript
// Sau khi save cabin selection
router.push(`/booking/seat-map?flightInstanceId=${flightInstanceId}`);

// Khi component mount (sau reload)
const flightInstanceId = searchParams.get('flightInstanceId');
if (flightInstanceId) {
  // Gọi API để lấy full state
  const state = await getBookingState(flightInstanceId);
  // Restore component state từ backend state
  setSelectedFlightId(state.flightInstanceId);
  setSelectedCabin(state.cabin.cabinType);
}
```

**Option 2: Backend State Recovery**
```typescript
// Khi component mount (sau reload)
useEffect(() => {
  // Lấy tất cả booking states từ backend
  const states = await getAllBookingStates();
  if (states.length > 0) {
    // Lấy state mới nhất
    const latestState = states[0];
    // Restore component state
    setSelectedFlightId(latestState.flightInstanceId);
    setSelectedCabin(latestState.cabin?.cabinType);
  }
}, []);
```

**Option 3: Hybrid (Best Practice)**
```typescript
// 1. Ưu tiên URL params (nếu có)
const flightInstanceIdFromUrl = searchParams.get('flightInstanceId');

// 2. Nếu không có URL params, lấy từ backend state
const flightInstanceId = flightInstanceIdFromUrl || (await getAllBookingStates())[0]?.flightInstanceId;

// 3. Restore component state
if (flightInstanceId) {
  const state = await getBookingState(flightInstanceId);
  setSelectedFlightId(state.flightInstanceId);
  setSelectedCabin(state.cabin?.cabinType);
}
```

## Frontend Usage Examples (Best Practice)

### Example 1: Trang Search Flights → Navigate với URL Params

```typescript
// app/components/FlightSearchResults.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function FlightSearchResults() {
  const router = useRouter();
  const [flights, setFlights] = useState([]);
  
  const handleSelectFlight = (flightInstanceId: string) => {
    // Navigate với flightInstanceId trong URL params
    router.push(`/booking/fare-options?flightInstanceId=${flightInstanceId}`);
  };

  return (
    <div>
      {flights.map((flight) => (
        <button 
          key={flight.id}
          onClick={() => handleSelectFlight(flight.flightInstanceId)}
        >
          Select Flight
        </button>
      ))}
    </div>
  );
}
```

### Example 2: Trang Fare Options → Lấy từ URL Params → Save Cabin → Navigate

```typescript
// app/components/FareOptionsPage.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function FareOptionsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Lấy flightInstanceId từ URL params (vì đã chuyển trang)
  const flightInstanceId = searchParams.get('flightInstanceId');
  
  // Component state cho UI của trang này
  const [cabinType, setCabinType] = useState<string>('economy');
  const [fareOptions, setFareOptions] = useState([]);
  const [selectedFareCode, setSelectedFareCode] = useState<string | null>(null);

  useEffect(() => {
    if (!flightInstanceId) {
      router.push('/booking/search');
      return;
    }

    // Load fare options
    loadFareOptions();
  }, [flightInstanceId]);

  const loadFareOptions = async () => {
    const response = await fetch(
      `/api/v1/search/fare-options?flightInstanceId=${flightInstanceId}&cabinType=${cabinType}`,
      {
        headers: {
          'Authorization': `Bearer ${getAccessToken()}`,
        },
      }
    );
    const data = await response.json();
    setFareOptions(data);
  };

  const handleSelectFare = async (fareClassCode: string) => {
    // 1. Lưu vào component state (cho UI)
    setSelectedFareCode(fareClassCode);

    // 2. Save vào backend state (Redis)
    const response = await fetch('/api/v1/booking-state/cabin', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({
        flightInstanceId, // Từ URL params
        cabinType,         // Từ component state
        fareClassCode,     // User selection
      }),
    });

    if (response.ok) {
      // 3. Navigate với flightInstanceId trong URL params
      router.push(`/booking/seat-map?flightInstanceId=${flightInstanceId}`);
    }
  };

  return (
    <div>
      <h2>Fare Options</h2>
      {fareOptions.map((fare) => (
        <button 
          key={fare.fareClassCode}
          onClick={() => handleSelectFare(fare.fareClassCode)}
        >
          {fare.fareClassName} - {fare.price}
        </button>
      ))}
    </div>
  );
}
```

### Example 3: Trang Seat Map → Lấy từ URL Params → Lấy cabinType từ Backend

```typescript
// app/components/SeatMapPage.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function SeatMapPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Lấy flightInstanceId từ URL params (vì đã chuyển trang)
  const flightInstanceId = searchParams.get('flightInstanceId');
  
  // Component state cho UI của trang này
  const [seats, setSeats] = useState([]);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!flightInstanceId) {
      router.push('/booking/search');
      return;
    }

    loadSeatMap();
  }, [flightInstanceId]);

  const loadSeatMap = async () => {
    try {
      // Option 1 (Recommended): Không truyền cabinType, backend tự động lấy từ Redis
      const response = await fetch(
        `/api/v1/search/seats?flightInstanceId=${flightInstanceId}`,
        {
          headers: {
            'Authorization': `Bearer ${getAccessToken()}`,
          },
        }
      );
      
      // Option 2: Lấy cabinType từ backend state trước (nếu muốn explicit)
      // const bookingState = await getBookingState(flightInstanceId);
      // const cabinType = bookingState.cabin?.cabinType;
      // const response = await fetch(
      //   `/api/v1/search/seats?flightInstanceId=${flightInstanceId}&cabinType=${cabinType}`,
      //   {
      //     headers: {
      //       'Authorization': `Bearer ${getAccessToken()}`,
      //     },
      //   }
      // );

      const data = await response.json();
      setSeats(data.seats);
    } catch (error) {
      console.error('Failed to load seat map:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSeat = async (flightSeatId: string, seatNumber: string) => {
    // 1. Lưu vào component state (cho UI)
    setSelectedSeatId(flightSeatId);

    // 2. Save vào backend state (Redis)
    const response = await fetch('/api/v1/booking-state/seat', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({
        flightInstanceId, // Từ URL params
        flightSeatId,      // User selection
        seatNumber,       // User selection
      }),
    });

    if (response.ok) {
      // 3. Navigate đến trang tiếp theo (reservation summary)
      router.push(`/booking/reservation-summary?flightInstanceId=${flightInstanceId}`);
    }
  };

  if (loading) return <div>Loading seat map...</div>;

  return (
    <div>
      <h2>Select Your Seat</h2>
      <div className="seat-map-grid">
        {seats.map((seat) => (
          <button
            key={seat.flightSeatId}
            className={`seat ${seat.isAvailable ? 'available' : 'unavailable'} ${selectedSeatId === seat.flightSeatId ? 'selected' : ''}`}
            onClick={() => seat.isAvailable && handleSelectSeat(seat.flightSeatId, seat.seatNumber)}
            disabled={!seat.isAvailable}
          >
            {seat.seatNumber}
          </button>
        ))}
      </div>
    </div>
  );
}

// Helper function
async function getBookingState(flightInstanceId: string) {
  const response = await fetch(
    `/api/v1/booking-state/${flightInstanceId}`,
    {
      headers: {
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    }
  );
  return response.json();
}

function getAccessToken(): string {
  // Get from your auth context/store
  return localStorage.getItem('access_token') || '';
}
```

### Example 4: Tạo Reservation (Backend tự động lấy cabin/seat từ Redis)

```typescript
// app/components/CreateReservationButton.tsx
'use client';

import { useSearchParams, useRouter } from 'next/navigation';

export default function CreateReservationButton() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Lấy flightInstanceId từ URL params
  const flightInstanceId = searchParams.get('flightInstanceId');

  const handleCreateReservation = async () => {
    // KHÔNG CẦN gửi fareClassCode và flightSeatId
    // Backend tự động lấy từ Redis
    const response = await fetch('/api/v1/reservations', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({
        segments: [
          {
            flightInstanceId, // Chỉ cần flightInstanceId (từ URL params)
            segmentType: 'outbound',
            // KHÔNG CẦN: fareClassCode, flightSeatId
            // Backend tự động lấy từ Redis
          },
        ],
        numberOfPassengers: 1,
        currencyCode: 'VND',
      }),
    });

    if (response.ok) {
      const reservation = await response.json();
      // Backend đã tự động:
      // 1. Lấy cabinSelection từ Redis
      // 2. Lấy seatSelection từ Redis
      // 3. Validate cabin và seat đã chọn
      // 4. Tạo reservation với fareClassCode và flightSeatId
      // 5. Clear booking state
      
      // Navigate đến trang confirmation
      router.push(`/booking/confirmation?reservationId=${reservation.reservationId}`);
    }
  };

  return (
    <button onClick={handleCreateReservation}>
      Create Reservation
    </button>
  );
}
```

### Summary: Flow với URL Params (Best Practice)

```
Trang 1: Search Flights
  → User chọn flight
  → router.push(`/booking/fare-options?flightInstanceId=${flightInstanceId}`)

Trang 2: Fare Options
  → Lấy flightInstanceId từ URL params
  → User chọn fare
  → Save cabin vào Redis
  → router.push(`/booking/seat-map?flightInstanceId=${flightInstanceId}`)

Trang 3: Seat Map
  → Lấy flightInstanceId từ URL params
  → Lấy cabinType từ backend state (hoặc backend tự lấy khi gọi API)
  → User chọn seat
  → Save seat vào Redis
  → router.push(`/booking/reservation-summary?flightInstanceId=${flightInstanceId}`)

Trang 4: Reservation Summary
  → Lấy flightInstanceId từ URL params
  → Verify state từ backend
  → User confirm
  → Create reservation (backend tự lấy cabin/seat từ Redis)
  → router.push(`/booking/confirmation?reservationId=${reservationId}`)
```

**Lợi ích của URL Params:**
- ✅ Shareable URLs (user có thể bookmark, share link)
- ✅ Browser back/forward buttons hoạt động đúng
- ✅ Reload page không mất data (đọc từ URL)
- ✅ SEO friendly
- ✅ Debug dễ dàng (có thể thấy flightInstanceId trong URL)