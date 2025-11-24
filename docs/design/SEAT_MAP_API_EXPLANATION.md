# Get Seat Map API - Giải thích chi tiết

## 📋 TÓM TẮT NHANH CHO FRONTEND DEVELOPER

### Sau khi chọn cabin và gửi `POST /api/v1/booking-state/cabin`:

**Bước tiếp theo - Trang Chọn Ghế:**

1. **Navigate đến trang Seat Map với flightInstanceId trong URL:**
   ```typescript
   router.push(`/booking/seat-map?flightInstanceId=${flightInstanceId}`);
   ```

2. **Trong trang Seat Map, gọi API Get Seat Map (KHÔNG CẦN cabinType):**
   ```typescript
   const flightInstanceId = searchParams.get('flightInstanceId');
   
   // ✅ RECOMMENDED: Không truyền cabinType, backend tự động lấy từ Redis
   const response = await fetch(
     `/api/v1/search/seats?flightInstanceId=${flightInstanceId}`,
     {
       headers: { 'Authorization': `Bearer ${accessToken}` }
     }
   );
   const seatMapData = await response.json();
   ```

3. **Render seat map và check `isSelectable`:**
   ```typescript
   seatMapData.seats.forEach(seatGroup => {
     seatGroup.list.forEach(seat => {
       // Chỉ cho phép click nếu isSelectable = true
       if (seat.isSelectable) {
         // Enable seat selection
       } else {
         // Disable seat (hiển thị nhưng không cho click)
       }
     });
   });
   ```

4. **Khi user chọn ghế, gọi API Save Seat Selection:**
   ```typescript
   await fetch('/api/v1/booking-state/seat', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${accessToken}`
     },
     body: JSON.stringify({
       flightInstanceId,
       flightSeatId: selectedSeat.flightSeatId,
       seatNumber: selectedSeat.seatNumber
     })
   });
   ```

**⚠️ LƯU Ý QUAN TRỌNG:**
- **KHÔNG CẦN** gọi `GET /api/v1/booking-state/:flightInstanceId` trước khi gọi seat map
- Backend tự động lấy `cabinType` từ Redis khi gọi `GET /api/v1/search/seats`
- Chỉ cần `flightInstanceId` từ URL params là đủ

---

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
   - **Frontend (Trang Seat Map) - STEP BY STEP**:
     
     **Bước 1: Lấy flightInstanceId từ URL params**
     ```typescript
     // Vì đã chuyển trang, component state của trang Fare Options đã mất
     const searchParams = useSearchParams();
     const flightInstanceId = searchParams.get('flightInstanceId');
     
     if (!flightInstanceId) {
       // Redirect về trang search nếu không có flightInstanceId
       router.push('/booking/search');
       return;
     }
     ```
     
     **Bước 2: Gọi API Get Seat Map (KHÔNG CẦN truyền cabinType)**
     ```typescript
     // ✅ Option 1 (Recommended): Không truyền cabinType
     // Backend tự động lấy cabinType từ Redis (đã save ở bước 3)
     const response = await fetch(
       `/api/v1/search/seats?flightInstanceId=${flightInstanceId}`,
       {
         headers: {
           'Authorization': `Bearer ${accessToken}`,
         },
       }
     );
     const seatMapData = await response.json();
     // seatMapData.seats = [
     //   { id: 'economy', list: [...] },
     //   { id: 'business', list: [...] }
     // ]
     ```
     
     **Hoặc nếu muốn explicit (Option 2):**
     ```typescript
     // Option 2: Lấy cabinType từ booking state trước (optional)
     const bookingState = await getBookingState(flightInstanceId);
     const cabinType = bookingState?.cabin?.cabinType;
     
     // Sau đó gọi API với cabinType (nhưng không cần thiết)
     const response = await fetch(
       `/api/v1/search/seats?flightInstanceId=${flightInstanceId}&cabinType=${cabinType}`,
       {
         headers: {
           'Authorization': `Bearer ${accessToken}`,
         },
       }
     );
     ```
     
     **⚠️ LƯU Ý**: 
     - **KHÔNG CẦN** gọi `GET /api/v1/booking-state/:flightInstanceId` trước khi gọi seat map
     - Backend tự động lấy `cabinType` từ Redis nếu không truyền
     - Chỉ cần gọi `GET /api/v1/search/seats?flightInstanceId=xxx` là đủ
   - **Backend tự quản lý**: 
     - Nếu `cabinType` không được truyền và user đã đăng nhập, backend tự động lấy `cabinType` từ booking state (nếu đã save cabin selection)
   - **Response**: 
     - **API LUÔN TRẢ VỀ CẢ ECONOMY VÀ BUSINESS SEATS** (ngay cả khi user chỉ chọn economy)
     - Mỗi seat có field `isSelectable`:
       - `isSelectable = true`: Seat thuộc cabin type được request và `isAvailable = true` → User có thể chọn
       - `isSelectable = false`: Seat thuộc cabin type khác hoặc `isAvailable = false` → User không thể chọn (nhưng vẫn hiển thị)
     - Danh sách tất cả ghế với `isAvailable`, `isSelectable`, `seatType`, `position`
   - **Frontend**: 
     - Render seat map UI (grid layout với left/right, window/aisle/middle)
     - **Disable seats với `isSelectable = false`** (hiển thị nhưng không cho click)
     - Điều này đảm bảo phần business không bị trống khi user chọn economy
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

### ❓ Câu hỏi: Tại sao không để frontend gửi lại `cabinType` và `fareClassCode` khi tạo reservation?

**Trả lời ngắn gọn:** Vì **Security**, **Consistency**, và **Simplicity**. Backend cần là **source of truth** để đảm bảo user không thể manipulate data.

### 🔍 So sánh 2 Approaches:

#### ❌ Approach 1: Frontend gửi lại cabinType/fareClassCode (KHÔNG AN TOÀN)

```typescript
// Frontend gửi khi tạo reservation
POST /api/v1/reservations
{
  "segments": [{
    "flightInstanceId": "xxx",
    "fareClassCode": "YS",  // ← Frontend gửi lại
    "cabinType": "economy"   // ← Frontend gửi lại
  }]
}
```

**Vấn đề:**
1. **Security Risk**: User có thể manipulate request, gửi `fareClassCode` khác với cabin đã chọn
   ```typescript
   // User chọn Economy Smart (YS) - giá 1,000,000 VND
   // Nhưng gửi request với Business Flex (JF) - giá 5,000,000 VND
   // Backend không biết user đã chọn gì → Không thể validate
   ```
2. **Inconsistency**: Frontend có thể gửi sai data (bug, network issue, etc.)
3. **Complexity**: Frontend phải nhớ và gửi lại nhiều thông tin

#### ✅ Approach 2: Backend tự động lấy từ Redis (AN TOÀN - HIỆN TẠI)

```typescript
// Frontend CHỈ gửi flightInstanceId
POST /api/v1/reservations
{
  "segments": [{
    "flightInstanceId": "xxx"
    // ← KHÔNG gửi fareClassCode, backend tự lấy từ Redis
  }]
}

// Backend code (reservation.service.ts):
const selections = await this.bookingStateService.getSelectionsForReservation(
  userId,
  segmentDto.flightInstanceId,
);
const fareClassCode = selections.cabin.fareClassCode; // ← Lấy từ Redis
```

**Lợi ích:**
1. **Security**: User không thể thay đổi cabin/seat sau khi đã chọn
2. **Consistency**: Backend là source of truth, không phụ thuộc frontend
3. **Simplicity**: Frontend chỉ cần gửi `flightInstanceId`

### 📋 Mục đích chính:

1. **Backend tự động lấy khi tạo Reservation** (Quan trọng nhất):
   - Khi user tạo reservation, backend **TỰ ĐỘNG** lấy `cabinType` và `fareClassCode` từ Redis
   - Frontend **KHÔNG CẦN** gửi `fareClassCode` trong request body
   - **⚠️ LƯU Ý**: Đây **KHÔNG PHẢI** là HTTP endpoint, mà là **internal service call** trực tiếp từ Redis
   - **Code thực tế** (từ `reservation.service.ts`):
     ```typescript
     // Line 184-189: Backend tự động lấy từ Redis qua internal service call
     const selections = await this.bookingStateService.getSelectionsForReservation(
       userId,
       segmentDto.flightInstanceId,
     );
     const fareClassCode = selections.cabin.fareClassCode; // ← Từ Redis
     const cabinType = selections.cabin.cabinType;         // ← Từ Redis
     ```
   - **Flow chi tiết**:
     1. `ReservationService.createReservation()` được gọi (khi user POST `/api/v1/reservations`)
     2. `ReservationService` gọi `BookingStateService.getSelectionsForReservation()` (internal method, không phải HTTP)
     3. `BookingStateService` gọi `BookingStateRepository.findOne()` để lấy từ Redis
     4. Redis trả về data với key: `booking:state:{userId}:{flightInstanceId}`
     5. Backend extract `cabinType` và `fareClassCode` từ Redis data
   - **Lợi ích**: 
     - Frontend đơn giản hơn (không cần nhớ và gửi lại cabin/seat)
     - Backend là source of truth (tránh mismatch giữa frontend và backend)
     - Security: Frontend không thể thay đổi cabin/seat sau khi đã chọn
     - Performance: Internal call nhanh hơn HTTP request

2. **Backend tự động lấy khi Get Seat Map**:
   - Nếu user không truyền `cabinType`, backend tự động lấy từ Redis
   - **Lợi ích**: Giảm số lượng parameters, UX tốt hơn
   - **Ví dụ**: User reload page → Frontend không cần nhớ `cabinType`, backend tự lấy

3. **Validation - Business Rules** (Quan trọng cho Data Integrity):
   - **Code thực tế** (từ `booking-state.service.ts`):
     ```typescript
     // Line 86-89: Validate cabin phải được chọn trước khi chọn seat
     if (!state.cabin) {
       throw new CabinNotSelectedException(flightInstanceId);
     }
     ```
   - Backend validate cabin đã được chọn trước khi cho phép chọn seat
   - Backend validate seat đã được chọn trước khi cho phép tạo reservation
   - **Lợi ích**: Đảm bảo flow đúng, tránh lỗi business logic
   - **Ví dụ**: User không thể chọn seat nếu chưa chọn cabin → Tránh lỗi data

4. **Recovery sau reload page** (Quan trọng cho UX):
   - Nếu user reload page, component state (useState) sẽ mất
   - **Solution**: Frontend gọi `GET /api/v1/booking-state` để lấy lại state từ backend
   - **Lợi ích**: User không mất progress, có thể tiếp tục booking
   - **Ví dụ**: User đã chọn cabin → Reload page → Frontend lấy lại từ Redis → User tiếp tục chọn seat

5. **Multi-tab support**:
   - User có thể mở nhiều tab, state được sync qua backend
   - **Lợi ích**: UX tốt hơn, không bị conflict giữa các tab
   - **Ví dụ**: User chọn cabin ở Tab 1 → Mở Tab 2 → Tab 2 cũng thấy cabin đã chọn

### 🔧 Cách Backend Lấy Cabin Selection từ Redis (Technical Details)

**⚠️ QUAN TRỌNG**: Backend **KHÔNG** lấy từ HTTP endpoint, mà lấy trực tiếp từ Redis qua **internal service call**.

**Flow chi tiết:**

1. **User gọi API tạo reservation:**
   ```typescript
   POST /api/v1/reservations
   {
     "segments": [{ "flightInstanceId": "xxx" }]
   }
   ```

2. **ReservationService.createReservation() được gọi:**
   ```typescript
   // File: src/microservices/reservation/reservation.service.ts
   // Line 184-189
   const selections = await this.bookingStateService.getSelectionsForReservation(
     userId,  // ← Từ JWT token (extracted ở API Gateway)
     segmentDto.flightInstanceId,
   );
   ```

3. **BookingStateService.getSelectionsForReservation() được gọi:**
   ```typescript
   // File: src/shared/services/booking-state.service.ts
   // Line 128-157
   async getSelectionsForReservation(userId: string, flightInstanceId: string) {
     // Lấy state từ Redis
     const state = await this.getBookingState(userId, flightInstanceId);
     // Validate và return
     return { cabin: state.cabin, seat: state.seat };
   }
   ```

4. **BookingStateRepository.findOne() được gọi:**
   ```typescript
   // File: src/shared/repositories/booking-state.repository.ts
   // Line 64-75
   async findOne(userId: string, flightInstanceId: string) {
     const key = `booking:state:${userId}:${flightInstanceId}`; // ← Redis key
     const state = await this.redisService.get<BookingState>(key); // ← Lấy từ Redis
     return state;
   }
   ```

5. **Redis trả về data:**
   ```json
   {
     "flightInstanceId": "xxx",
     "cabin": {
       "cabinType": "economy",
       "fareClassCode": "YS"
     },
     "seat": {
       "flightSeatId": "yyy",
       "seatNumber": "10A"
     },
     "updatedAt": "2025-11-24T10:00:00Z"
   }
   ```

**Tóm lại:**
- ❌ **KHÔNG** phải HTTP endpoint như `GET /api/v1/booking-state/:id`
- ✅ **LÀ** internal service call: `ReservationService` → `BookingStateService` → `BookingStateRepository` → `Redis`
- ✅ **Redis Key**: `booking:state:{userId}:{flightInstanceId}`
- ✅ **Performance**: Internal call nhanh hơn HTTP request (không qua network)

### 💡 Ví dụ cụ thể: Tại sao cần save cabin selection?

**Scenario:** User chọn Economy Smart (YS) với giá 1,000,000 VND

#### ❌ Nếu KHÔNG save vào Redis (Frontend gửi lại):

```typescript
// Step 1: User chọn cabin
// Frontend: Lưu vào component state
const selectedCabin = { cabinType: 'economy', fareClassCode: 'YS' };

// Step 2: User chọn seat
// Frontend: Vẫn dùng component state

// Step 3: User tạo reservation
// Frontend: Gửi lại cabinType và fareClassCode
POST /api/v1/reservations
{
  "segments": [{
    "flightInstanceId": "xxx",
    "fareClassCode": "YS"  // ← Frontend gửi lại
  }]
}

// ⚠️ VẤN ĐỀ: User có thể manipulate request
// User mở DevTools → Thay đổi request:
{
  "segments": [{
    "flightInstanceId": "xxx",
    "fareClassCode": "JF"  // ← Đổi thành Business Flex (5,000,000 VND)
  }]
}
// Backend không biết user đã chọn gì → Không thể validate → Tạo reservation với giá sai!
```

#### ✅ Nếu save vào Redis (Backend tự lấy):

```typescript
// Step 1: User chọn cabin
POST /api/v1/booking-state/cabin
{
  "flightInstanceId": "xxx",
  "cabinType": "economy",
  "fareClassCode": "YS"
}
// Backend: Lưu vào Redis với key `booking:state:{userId}:{flightInstanceId}`

// Step 2: User chọn seat
POST /api/v1/booking-state/seat
{
  "flightInstanceId": "xxx",
  "flightSeatId": "yyy"
}
// Backend: Validate cabin đã được chọn (từ Redis) → Lưu seat vào Redis

// Step 3: User tạo reservation
POST /api/v1/reservations
{
  "segments": [{
    "flightInstanceId": "xxx"
    // ← KHÔNG gửi fareClassCode
  }]
}

// Backend code (reservation.service.ts):
const selections = await this.bookingStateService.getSelectionsForReservation(
  userId,
  "xxx"
);
const fareClassCode = selections.cabin.fareClassCode; // ← Lấy từ Redis: "YS"

// ✅ Security: User không thể thay đổi fareClassCode vì backend tự lấy từ Redis
// ✅ Consistency: Backend luôn dùng đúng fareClassCode mà user đã chọn
// ✅ Simplicity: Frontend chỉ cần gửi flightInstanceId
```

### 🎯 Kết luận:

**Tại sao phải save cabin selection vào Redis?**

1. **Security**: Ngăn user manipulate request, thay đổi cabin/seat sau khi đã chọn
2. **Data Integrity**: Backend là source of truth, đảm bảo consistency
3. **Business Rules**: Validate flow đúng (cabin → seat → reservation)
4. **UX**: Recovery sau reload, multi-tab support
5. **Simplicity**: Frontend không cần nhớ và gửi lại nhiều thông tin

**Nếu không save vào Redis:**
- ❌ User có thể hack request, chọn cabin khác với giá khác
- ❌ Frontend phải nhớ và gửi lại nhiều thông tin
- ❌ Không có validation, dễ bị lỗi business logic
- ❌ Reload page mất hết data

**Với Redis:**
- ✅ Backend tự động lấy, user không thể manipulate
- ✅ Frontend đơn giản, chỉ cần gửi `flightInstanceId`
- ✅ Validation đầy đủ, đảm bảo flow đúng
- ✅ Recovery tốt, UX tốt hơn

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

### Example 3: Trang Seat Map → Lấy từ URL Params → Gọi Get Seat Map (KHÔNG CẦN cabinType)

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
      // ✅ RECOMMENDED: Không truyền cabinType, backend tự động lấy từ Redis
      // Backend đã lưu cabinType ở bước save cabin selection
      const response = await fetch(
        `/api/v1/search/seats?flightInstanceId=${flightInstanceId}`,
        {
          headers: {
            'Authorization': `Bearer ${getAccessToken()}`,
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to load seat map: ${response.statusText}`);
      }

      const data = await response.json();
      // data.seats = [
      //   { id: 'economy', list: [...] },
      //   { id: 'business', list: [...] }
      // ]
      setSeats(data.seats);
      
      // ⚠️ LƯU Ý: KHÔNG CẦN gọi getBookingState() trước
      // Backend tự động lấy cabinType từ Redis khi gọi get seat map
    } catch (error) {
      console.error('Failed to load seat map:', error);
      // Handle error: Redirect hoặc show error message
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
        {seats.map((seatGroup) => (
          <div key={seatGroup.id} className={`cabin-section ${seatGroup.id}`}>
            <h3>{seatGroup.id === 'business' ? 'Business Class' : 'Economy Class'}</h3>
            {seatGroup.list.map((seat) => (
              <button
                key={seat.flightSeatId}
                className={`seat ${seat.isSelectable ? 'selectable' : 'non-selectable'} ${seat.isAvailable ? 'available' : 'unavailable'} ${selectedSeatId === seat.flightSeatId ? 'selected' : ''}`}
                onClick={() => {
                  // ✅ CHỈ cho phép click nếu isSelectable = true
                  if (seat.isSelectable) {
                    handleSelectSeat(seat.flightSeatId, seat.seatNumber);
                  }
                }}
                disabled={!seat.isSelectable}
                title={!seat.isSelectable ? `This seat is not available for your selected cabin type` : ''}
              >
                {seat.seatNumber}
              </button>
            ))}
          </div>
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

---

## Thay đổi quan trọng: API luôn trả về cả Economy và Business Seats

### Vấn đề trước đây:
- API chỉ trả về seats của cabin type được request
- Khi user chọn economy, phần business bị trống → UI không đẹp
- Frontend không thể hiển thị đầy đủ seat map

### Giải pháp (Best Practice):
- **API LUÔN TRẢ VỀ CẢ ECONOMY VÀ BUSINESS SEATS** (bất kể cabinType được request)
- Thêm field `isSelectable` vào mỗi seat:
  - `isSelectable = true`: Seat thuộc cabin type được request và `isAvailable = true` → User có thể chọn
  - `isSelectable = false`: Seat thuộc cabin type khác hoặc `isAvailable = false` → User không thể chọn (nhưng vẫn hiển thị)

### Response Structure mới:
```json
{
  "flightInstanceId": "...",
  "flightNumber": "VN123",
  "cabinType": "economy",
  "seats": [
    {
      "id": "economy",
      "list": [
        {
          "flightSeatId": "...",
          "seatNumber": "10A",
          "cabinClassCode": "Y",
          "seatType": "window",
          "isExitRow": false,
          "position": "left",
          "isAvailable": true,
          "isSelectable": true,  // ← NEW FIELD: Có thể chọn vì thuộc economy
          "note": "es"
        }
      ]
    },
    {
      "id": "business",
      "list": [
        {
          "flightSeatId": "...",
          "seatNumber": "1A",
          "cabinClassCode": "J",
          "seatType": "window",
          "isExitRow": false,
          "position": "left",
          "isAvailable": true,
          "isSelectable": false,  // ← NEW FIELD: Không thể chọn vì không thuộc economy
          "note": "bf"
        }
      ]
    }
  ]
}
```

### Logic `isSelectable`:
```typescript
// Backend logic
const isSelectable = requestedCabinClassCodes.includes(cabinCode) && seat.is_available;
```

- Nếu user request `economy`:
  - Economy seats với `isAvailable = true` → `isSelectable = true`
  - Business seats (dù `isAvailable = true`) → `isSelectable = false`
- Nếu user request `business`:
  - Business seats với `isAvailable = true` → `isSelectable = true`
  - Economy seats (dù `isAvailable = true`) → `isSelectable = false`

### Frontend Usage:
```typescript
// Frontend check isSelectable để disable/enable seats
seats.forEach(seatGroup => {
  seatGroup.list.forEach(seat => {
    if (!seat.isSelectable) {
      // Disable seat selection UI
      // Show seat but make it non-clickable
      // Có thể thêm tooltip: "This seat is not available for your selected cabin type"
    }
  });
});
```

### Lợi ích:
1. ✅ Frontend luôn có đầy đủ dữ liệu để hiển thị cả 2 phần cabin
2. ✅ UI không bị trống ở phần business khi user chọn economy
3. ✅ User vẫn chỉ có thể chọn seats phù hợp với cabin type đã chọn
4. ✅ Không breaking change: Thêm field mới, không xóa field cũ
5. ✅ Logic rõ ràng: `isSelectable` cho biết seat nào có thể chọn