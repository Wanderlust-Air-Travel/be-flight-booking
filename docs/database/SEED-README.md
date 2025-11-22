# Full Database Seed Script

Script seed database với hàng ngàn records cho mỗi table, data realistic và tuân thủ tất cả constraints.

**Lưu ý quan trọng:** Hệ thống chỉ hỗ trợ bay nội địa Việt Nam. Tất cả airports đều là sân bay Việt Nam, tất cả routes đều là domestic routes.

## Cách chạy

```bash
npm run seed:full
```

## Files hỗ trợ

### `sql/utils/data-management/clear-all-seed-data.sql`
Script SQL để xóa toàn bộ data trong database, cho phép chạy lại seed từ đầu.

**Cách sử dụng:**
1. Mở file `sql/utils/data-management/clear-all-seed-data.sql` trong SQL Server Management Studio (SSMS)
2. Kiểm tra và sửa database name (dòng 6) nếu cần: `USE flight_booking_db;`
3. Chạy script (F5 hoặc Execute)
4. Sau khi xóa xong, chạy lại: `npm run seed:full`

**Lưu ý:**
- Script sử dụng transaction để đảm bảo an toàn (rollback nếu có lỗi)
- Xóa data theo đúng thứ tự foreign key constraints
- Xóa cả master data (Currencies, PaymentMethods) - comment nếu muốn giữ lại
- Xem chi tiết trong section "Nếu muốn reset database" bên dưới

## Dữ liệu được tạo

### 1. Currencies & Payment Methods
- 3 currencies: VND, USD, EUR
- 5 payment methods: CARD, BANK, MOMO, ZALO, VNPAY

### 2. Cabin Classes & Fare Classes
- 4 cabin classes: Y (Economy), J (Business), F (First), W (Premium Economy)
- 7 fare classes:
  - Economy: YSM (Saver Max), Y (Standard), YS (Smart), YF (Flex)
  - Business: J (Standard), JS (Smart), JF (Flex)

### 3. Aircraft Types & Aircrafts
- 6 aircraft types: A320, A321, A350, B737, B787, ATR72
- **Tất cả aircraft types đều có 180 ghế** (standardized configuration)
- 100+ aircrafts với registration numbers

### 4. Seat Configurations
- Tự động tạo seat configurations cho mỗi aircraft type
- **Tổng số ghế**: 180 ghế cho tất cả aircraft types
- **Business seats**: 18 ghế (10%) = 3 hàng × 6 ghế
- **Economy seats**: 162 ghế (90%) = 27 hàng × 6 ghế
- **Seat Naming Convention** (được định nghĩa trong `src/shared/constants/seat.constants.ts`):
  - Format: `{row}{column}` (ví dụ: `1A`, `2B`, `10F`)
  - Columns: A, B, C, D, E, F (6 cột mỗi hàng)
  - Seat Types:
    - **Window**: A, F (ghế cửa sổ)
    - **Middle**: B, E (ghế giữa)
    - **Aisle**: C, D (ghế lối đi)
- **Business seats**: Rows 1-3 (Window, Middle, Aisle positions)
- **Economy seats**: Rows 4-30 (Window, Middle, Aisle positions)
- **Constants**: Seed file sử dụng constants từ `src/shared/constants/seat.constants.ts` để đảm bảo tính nhất quán
  - `SEAT_COLUMNS`: `['A', 'B', 'C', 'D', 'E', 'F']`
  - `SEAT_TYPE_MAP`: Mapping cột → loại ghế
  - `SEAT_DISTRIBUTION`: Cấu hình phân bổ (10% Business, 6 cột/hàng)
  - Helper functions: `generateSeatNumber()`, `getSeatType()`

### 5. Airports
- 20 airports (tất cả đều là sân bay nội địa Việt Nam)
- Bao gồm: HAN, SGN, DAD, CXR, PQC, HUI, VCA, HPH, VDO, THD, VII, DIN, VCL, UIH, TBB, PXU, BMV, DLI, CAH, VKG
- Tất cả airports đều có country = 'Vietnam'
- Hệ thống chỉ hỗ trợ bay nội địa giữa các tỉnh thành Việt Nam

### 6. Routes
- Tạo routes giữa tất cả airports Việt Nam
- Tất cả routes đều là domestic (is_domestic = true)
- Distance được tính tự động (200-1200 km cho routes nội địa)
- Tổng cộng: 20 x 19 = 380 routes (mỗi airport đến 19 airports khác)

### 7. Users & Passengers
- 500 users với:
  - Vietnamese names
  - Unique emails
  - Hashed passwords (default: `Password123!`)
  - Phone numbers
- 1-3 passengers per user
- 30% passengers có loyalty numbers

### 8. Flight Schedules
- 300-450 flight schedules
- Tạo cho 150 routes (ưu tiên domestic routes)
- 2-3 schedules per route
- Operating patterns: Daily, Mon/Wed/Fri/Sun, Tue/Thu/Sat, Mon-Fri, Sat-Sun
- Effective từ hôm nay đến 1 năm sau
- Flight numbers: BBO, VNA, VJ, QH
- Tự động tránh duplicate flight numbers trong cùng period

### 9. Flight Instances & Flight Seats
- Hàng ngàn flight instances cho 60 ngày (2 tháng) tới
- Xử lý 50 schedules đầu tiên (để giảm số lượng seats)
- Mỗi instance có đầy đủ seats
- 70% seats available (30% đã được book)
- Status: scheduled, on_time, delayed

### 10. Bookings & Related Data
- 500-1,000 bookings với:
  - Unique PNR codes
  - 1-4 passengers per booking
  - 1-2 flight segments per booking
  - Status: confirmed, pending, cancelled, completed
- Booking Passengers
- Booking Segments với fare classes và pricing
- Tickets (cho confirmed bookings)
- Payments với various payment methods

## Thống kê dữ liệu

Sau khi chạy seed, bạn sẽ có:
- **Airports**: ~20
- **Routes**: ~380 (20 x 19)
- **Aircraft Types**: 6 (tất cả đều có 180 ghế)
- **Aircrafts**: 100+
- **Seat Configurations**: ~1,080 (6 aircraft types × 180 seats = 1,080 total seats)
  - Business seats: ~108 (6 types × 18 business seats)
  - Economy seats: ~972 (6 types × 162 economy seats)
- **Flight Schedules**: 300-450 (150 routes × 2-3 schedules)
- **Flight Instances**: Hàng ngàn (50 schedules × 60 ngày × operating days)
- **Flight Seats**: Hàng chục ngàn (instances × 180 seats per aircraft)
- **Users**: 500
- **Passengers**: 500-1,500 (1-3 per user)
- **Bookings**: 500-1,000
- **Tickets**: ~300+ (cho confirmed bookings)
- **Payments**: ~400+ (cho non-cancelled bookings)

## Lưu ý

1. **Thời gian chạy**: Script có thể mất 15-45 phút tùy vào hiệu năng database
2. **Database size**: Sẽ tạo ra database lớn (~200MB - 1GB)
3. **Unique constraints**: Script tự động check và skip nếu data đã tồn tại
4. **Password mặc định**: Tất cả users có password `Password123!`
5. **Batch processing**: Sử dụng batch inserts để optimize performance
6. **UUID v7**: 
   - Tất cả primary keys trong database sử dụng **UUID v7** (time-ordered UUID) thay vì SQL Server `NEWSEQUENTIALID()`
   - UUID v7 format: `xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx` (chữ số `7` ở vị trí version)
   - UUID v7 có thể sắp xếp theo thời gian, tốt cho database indexing
   - Tất cả entities (User, FlightInstance, Booking, etc.) đều tự generate UUID v7 trong seed script
   - API validation yêu cầu UUID v7 format cho `flightInstanceId` và các IDs khác

## Troubleshooting

### Nếu gặp lỗi timeout:
- Tăng timeout trong SQL Server
- Chạy từng phần một (comment các phần không cần)

### Nếu gặp lỗi memory:
- Giảm số lượng records trong script
- Chạy trên máy có nhiều RAM hơn

### Nếu muốn reset database:

**Cách 1: Sử dụng script SQL (Khuyến nghị)**

Sử dụng file `sql/utils/data-management/clear-all-seed-data.sql` để xóa toàn bộ data một cách an toàn:

1. Mở **SQL Server Management Studio (SSMS)**
2. Kết nối đến database của bạn
3. Mở file `sql/utils/data-management/clear-all-seed-data.sql`
4. **Lưu ý**: Kiểm tra và sửa database name trong file (dòng 6):
   ```sql
   USE flight_booking_db;  -- Thay đổi nếu database name khác
   ```
5. Chạy script (F5 hoặc Execute)
6. Script sẽ xóa tất cả data theo đúng thứ tự (từ child tables đến parent tables)
7. Sau khi xóa xong, chạy lại: `npm run seed:full`

**Script này sẽ:**
- Xóa tất cả data theo đúng thứ tự foreign key constraints
- Sử dụng transaction để đảm bảo an toàn (rollback nếu có lỗi)
- Hiển thị progress cho từng bảng
- Xóa cả master data (Currencies, PaymentMethods) - có thể comment nếu muốn giữ lại

**Cách 2: Xóa thủ công (Không khuyến nghị)**
```sql
-- Xóa tất cả data (cẩn thận!)
TRUNCATE TABLE BookingSegments;
TRUNCATE TABLE BookingPassengers;
TRUNCATE TABLE Tickets;
TRUNCATE TABLE Payments;
TRUNCATE TABLE Bookings;
TRUNCATE TABLE FlightSeats;
TRUNCATE TABLE FlightInstances;
TRUNCATE TABLE FlightSchedules;
TRUNCATE TABLE Routes;
-- ... (các tables khác)
```

## Customization

Bạn có thể chỉnh sửa các constants trong script:
- Số lượng users: `for (let i = 0; i < 500; i++)`
- Số lượng aircrafts: `for (let i = 1; i <= 100; i++)`
- Số lượng bookings: `const maxBookings = Math.min(1000, ...)`
- Số ngày generate instances: `endDate.setDate(endDate.getDate() + 60)`
- Số routes để tạo schedules: `const maxRoutes = Math.min(150, ...)`
- Số schedules per route: `const numSchedules = randomInt(2, 3)`
- Số schedules để xử lý: `schedules.slice(0, 50)`

