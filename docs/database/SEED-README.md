# Database Seed – Hướng dẫn

Dự án thiết kế cho **hãng bay riêng** (airline-owned): dữ liệu chuyến bay **lưu trong DB**, do hãng quản lý. Xem **[ARCHITECTURE-DATA.md](../ARCHITECTURE-DATA.md)** để hiểu best practice (OTA vs hãng bay, real-time vs lưu DB, VN nội địa).

## Luồng seed đề xuất (hãng bay nội địa VN)

1. **Reference data (một lần)**  
   ```bash
   npm run seed:full
   ```  
   Tạo: Currencies, Payment methods, Cabin/Fare classes, Baggage, Cabin services, Fare rules, 1 Aircraft type (A320), 1 Aircraft, Seat config, 1 admin user. **Không** tạo sân bay / routes / lịch bay.

2. **Lịch bay nội bộ (sân bay VN + routes + schedules/instances)**  
   ```bash
   npm run seed:internal-schedule
   ```  
   Tạo: Sân bay VN (9 sân bay), routes nội địa (SGN–HAN, HAN–DAD, …), flight schedules, instances (30 ngày), seats, giá. **Không** cần Amadeus.

3. **(Tùy chọn) Demo từ Amadeus**  
   ```bash
   npm run sync:flight-data
   ```  
   Cần `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`. Chỉ để thử API bên ngoài, không dùng làm nguồn chính cho hãng bay.

## Cách chạy từng script

```bash
npm run seed:full              # Reference + master tối thiểu + admin
npm run seed:internal-schedule # Sân bay VN + lịch nội bộ (sau seed:full)
npm run sync:flight-data       # (Optional) Sync từ Amadeus test
```

## Files hỗ trợ

### Reset database

Để xóa toàn bộ data và chạy lại seed từ đầu, có thể dùng script TypeORM hoặc xóa volume Docker:

```bash
# Cách 1: Xóa Docker volumes (mất hết data)
docker compose -f docker-compose.yml -f docker-compose.infrastructure.yml down -v
npm run docker:init-db
npm run seed:full

# Cách 2: Chạy seed lại (sẽ xóa data cũ nếu có, sau đó seed lại)
npm run seed:full
npm run seed:internal-schedule
```

## Dữ liệu được tạo

### `seed:full` (reference + master tối thiểu)

- **Currencies & Payment methods**: VND, USD, EUR; CREDIT_CARD, DEBIT_CARD, BANK_TRANSFER, EWALLET, CASH
- **Cabin & Fare classes**: Y, J, F, W; YSM, YSMX, YS, YF, YFLX, Y; JS, JF, JFLX, J
- **Baggage allowances, Cabin services, Fare description rules**: theo từng fare class
- **1 Aircraft type**: A320 (180 ghế), **1 Aircraft**: VN-A320-001, **Seat configurations** cho A320
- **1 Admin user**: admin@flightbooking.com / Password123! (roles ADMIN, CUSTOMER)
- **Không** tạo: Airports, Routes, Flight schedules/instances, Users/Passengers/Bookings

### `seed:internal-schedule` (lịch nội bộ – hãng bay VN)

- **Airports**: 9 sân bay VN (HAN, SGN, DAD, CXR, PQC, HUI, VCA, HPH, DLI)
- **Routes**: 12 tuyến nội địa (SGN–HAN, HAN–SGN, SGN–DAD, DAD–SGN, HAN–DAD, DAD–HAN, SGN–CXR, CXR–SGN, SGN–PQC, PQC–SGN, HAN–HPH, HPH–HAN)
- **Flight schedules**: 1 schedule/route, daily (operating_days 1234567), số hiệu BBO001–BBO012
- **Flight instances**: 30 ngày (từ ngày mai), mỗi ngày 1 chuyến/route, giờ 06:00–07:30
- **Flight seats**: đủ ghế theo seat config A320, tất cả available
- **Route fare prices**: giá Y 1.500.000 VND (base) cho các route

## Thống kê sau khi chạy đủ luồng

Sau `seed:full` + `seed:internal-schedule`:
- **Currencies**: 3 | **Payment methods**: 5 | **Cabin/Fare classes, Baggage, Cabin services, Fare rules**: đủ dùng
- **Aircraft types**: 1 (A320) | **Aircrafts**: 1 | **Seat configurations**: 180 (cho A320)
- **Airports**: 9 (VN) | **Routes**: 12 (nội địa)
- **Flight Schedules**: 12 | **Flight Instances**: 12 × 30 = 360 | **Flight Seats**: 360 × 180
- **Users**: 1 (admin) | **Bookings/Tickets/Payments**: 0 (tạo khi khách đặt)

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

