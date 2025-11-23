# Get Seat Map API - Giải thích chi tiết

## Flow hoàn chỉnh

**Nguyên tắc:** Backend tự quản lý toàn bộ state trong Redis. Frontend chỉ cần gọi API để lưu và fetch state.

**Lưu ý quan trọng về State Management:**
- **Component State (OK)**: Frontend có thể lưu `flightInstanceId` và `cabinType` trong **component state** (React state, Vue data, etc.) để sử dụng trong cùng một flow/component. Đây là temporary state cho UI, không phải persistent storage.
- **Session/LocalStorage (KHÔNG CẦN)**: **KHÔNG cần lưu vào session/localStorage** - backend tự động quản lý persistent state trong Redis
- **Backend State (Source of Truth)**: Sau khi save cabin selection, frontend có thể lấy `flightInstanceId` và `cabinType` từ `GET /api/v1/booking-state` - đây là source of truth
- **Best Practice**: 
  - Lần đầu: Dùng component state để truyền `flightInstanceId` và `cabinType` vào API
  - Sau khi save: Có thể lấy từ backend state thay vì component state
  - Refresh page: Lấy từ backend state, không cần component state

1. **Search Flights** → `GET /api/v1/search/flights`
   - User chọn chuyến bay → Lấy `flightInstanceId`
   - **Frontend**: 
     - Lưu `flightInstanceId` trong **component state** (để dùng trong flow hiện tại) 
     - **KHÔNG cần lưu vào session/localStorage** 
   - **Lưu ý**: `flightInstanceId` sẽ được lưu vào booking state khi save cabin selection

2. **Get Fare Options** → `GET /api/v1/search/fare-options?flightInstanceId=xxx&cabinType=economy` (cả 2 đều optional)
   - User xem các loại vé (Saver Max, Standard, Smart, Flex)
   - User chọn loại vé → Lấy `fareClassCode` (ví dụ: `YS`)
   - **Backend tự quản lý**: 
     - Nếu `flightInstanceId` và `cabinType` không được truyền và user đã đăng nhập, backend tự động lấy từ booking state (nếu đã save cabin selection trước đó)
     - Frontend có thể lấy `flightInstanceId` từ `GET /api/v1/booking-state` (không cần lưu vào session)
   - **Frontend**: 
     - **Lần đầu (chưa save cabin)**: Truyền `flightInstanceId` (từ search results - component state) và `cabinType` (user selection từ UI)
     - **Lần sau (đã save cabin)**: Có thể gọi lại mà không cần truyền (backend tự động lấy từ booking state)
     - **Lưu ý**: `flightInstanceId` và `cabinType` có thể lưu trong component state để dùng trong flow hiện tại, nhưng không cần lưu vào session

3. **Save Cabin Selection** → `POST /api/v1/booking-state/cabin`
   - **Backend tự quản lý**: Lưu `{flightInstanceId, cabinType, fareClassCode}` vào Redis
   - **Key format**: `booking:state:{userId}:{flightInstanceId}`
   - **TTL**: 30 phút (dài hơn reservation TTL 15 phút)
   - **Frontend**: Chỉ gọi API, không cần lưu state ở client

4. **Get Seat Map** → `GET /api/v1/search/seats?flightInstanceId=xxx&cabinType=economy` (cabinType optional)
   - **Mục đích**: Hiển thị bản đồ ghế cho user chọn
   - **Backend tự quản lý**: 
     - Nếu `cabinType` không được truyền và user đã đăng nhập, backend tự động lấy `cabinType` từ booking state (nếu đã save cabin selection)
     - Frontend có thể lấy `flightInstanceId` từ `GET /api/v1/booking-state` (không cần lưu vào session)
   - **Response**: Danh sách tất cả ghế với `isAvailable`, `seatType`, `position`
   - **Frontend**: Render seat map UI (grid layout với left/right, window/aisle/middle)
   - **Lưu ý**: 
     - **Frontend hoàn toàn stateless**: Không cần lưu `flightInstanceId` và `cabinType` trong session
     - Lấy `flightInstanceId` từ `GET /api/v1/booking-state` (sau khi save cabin selection)
     - Nếu đã save cabin selection, chỉ cần truyền `flightInstanceId`, backend tự động lấy `cabinType`
     - Nếu chưa save cabin selection, vẫn phải truyền `cabinType` trong query

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

## Example Flow

### 1. Search Flights

``` typescript
// app/components/FlightSearchResults.tsx
'use client'; // Bắt buộc để dùng useState trong Next.js App Router

import { useState } from 'react';

export default function FlightSearchResults() {
  // 1. Khởi tạo Component State
  // Ban đầu chưa chọn gì nên để là null
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [selectedCabin, setSelectedCabin] = useState<string | null>(null);

  // Giả lập danh sách chuyến bay từ API Search
  const flights = [
    { id: 'FL001', time: '08:00', price: 100 },
    { id: 'FL002', time: '14:00', price: 120 },
  ];

  // Hàm xử lý khi người dùng chọn
  const handleSelectFlight = (flightId: string, cabin: string) => {
    // Cập nhật State: React sẽ render lại giao diện ngay lập tức
    setSelectedFlightId(flightId);
    setSelectedCabin(cabin);
    
    console.log(`Đã lưu tạm vào State: ID=${flightId}, Cabin=${cabin}`);
    
    // Bước tiếp theo (theo flow của bạn): 
    // Gọi API lưu selection này vào Redis (Backend State)
    // saveSelectionToBackend(flightId, cabin);
  };

  return (
    <div className="p-4">
      <h2>Kết quả tìm kiếm</h2>
      <div className="space-y-4">
        {flights.map((flight) => (
          <div 
            key={flight.id} 
            className={`border p-4 rounded ${selectedFlightId === flight.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
          >
            <p>Chuyến bay: {flight.id} - Giờ: {flight.time}</p>
            
            <div className="mt-2 space-x-2">
              {/* Nút chọn Economy */}
              <button 
                onClick={() => handleSelectFlight(flight.id, 'ECONOMY')}
                className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
              >
                Chọn Economy
              </button>

              {/* Nút chọn Business */}
              <button 
                onClick={() => handleSelectFlight(flight.id, 'BUSINESS')}
                className="px-3 py-1 bg-yellow-200 rounded hover:bg-yellow-300"
              >
                Chọn Business
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Hiển thị State hiện tại để debug */}
      {selectedFlightId && (
        <div className="mt-4 p-2 bg-green-100 text-green-800">
          <strong>State hiện tại (Component State):</strong> <br/>
          Flight ID: {selectedFlightId} <br/>
          Cabin: {selectedCabin}
        </div>
      )}
    </div>
  );
}
```