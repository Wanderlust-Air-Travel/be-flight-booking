# Kiến trúc dữ liệu & Best practice: Hệ thống cho Hãng bay (Airline-owned)

Tài liệu này mô tả cách vận hành dữ liệu phù hợp với **mô hình hãng bay riêng** (một airline quản lý chuyến bay và bán vé của chính mình), không phải OTA (đại lý trung gian tổng hợp nhiều hãng).

---

## 1. Phân biệt hai mô hình

| Khía cạnh | OTA / Đại lý (Trung gian đặt vé) | Hãng bay riêng (Airline-owned) |
|-----------|-----------------------------------|---------------------------------|
| **Chủ dữ liệu chuyến bay** | GDS / API bên thứ ba (Amadeus, Sabre…) | **Chính hãng** – hệ thống nội bộ |
| **Nguồn hiển thị chuyến bay** | Gọi API provider real-time để search, hiển thị offer | **DB nội bộ** – schedule/instance do hãng tạo, hiển thị từ DB |
| **Lưu gì vào DB** | Chủ yếu **transaction**: booking, payment, ticket; có thể cache offer tạm | **Master + Schedule + Transaction**: sân bay, routes, lịch bay, giá, booking, payment, ticket |
| **Real-time vs lưu DB** | Search real-time từ GDS; booking xong mới lưu | Lịch/giá **lưu DB** (cập nhật bởi Schedule Planner / Revenue); availability có thể real-time từ inventory hoặc từ DB |

**Dự án này thiết kế cho hãng bay riêng** → best practice là **làm chủ dữ liệu chuyến bay trong DB**, không phụ thuộc “lấy chuyến bay từ provider để hiển thị” như OTA.

---

## 2. Best practice cho hãng bay (Vietnam nội địa)

### 2.1. Dữ liệu nên **lưu vào DB** (source of truth của hãng)

- **Master data**
  - **Sân bay**: danh sách sân bay (VN: CAAV/IATA), ít thay đổi → seed/import một lần.
  - **Tuyến bay (Routes)**: do hãng khai báo (ví dụ SGN–HAN, HAN–DAD…) → lưu DB.
  - **Loại tàu / Tàu (Aircraft types, Aircrafts)**: fleet của hãng → lưu DB.
  - **Hạng ghế / Hạng giá (Cabin, Fare class, Baggage, Cabin services, Fare rules)**: cấu hình sản phẩm của hãng → lưu DB.
- **Lịch bay**
  - **Flight schedules**: chuyến bay định kỳ (số hiệu, tuyến, giờ, ngày hiệu lực) do **Schedule Planner** tạo/cập nhật → lưu DB.
  - **Flight instances**: từng chuyến cụ thể theo ngày (flight_date, departure/arrival time) → lưu DB.
  - **Flight seats**: capacity/availability theo instance → lưu DB (trừ khi có hệ thống inventory riêng real-time).
- **Giá**
  - **Route fare price**: giá theo tuyến/hạng vé, do **Revenue / Quản lý giá** cấu hình → lưu DB (hoặc gọi engine pricing nếu có).
- **Giao dịch (luôn lưu)**
  - **Booking, Reservation, Payment, Ticket**: mọi giao dịch đặt chỗ/thanh toán/vé đều lưu DB.

### 2.2. Real-time hay không?

- **Tìm chuyến / Hiển thị chuyến**: đọc từ **DB** (schedules, instances, seats, fare) là đủ. Không bắt buộc gọi API bên ngoài mỗi lần search.
- **Availability (ghế trống)**: có thể:
  - **Cách 1**: tính từ DB (số ghế trừ đi đã đặt) – phù hợp dự án vừa/nhỏ.
  - **Cách 2**: gọi inventory/revenue system real-time nếu hãng đã có PSS (Sabre, Amadeus PSS, v.v.).
- **Giá**: có thể lưu sẵn (RouteFarePrice) hoặc gọi engine pricing real-time nếu có.

**Kết luận**: Với hãng bay riêng, **lấy chuyến bay để hiển thị trong web = đọc từ DB** (schedule/instance đã do hãng quản lý). Chỉ lưu transaction (booking, payment, ticket) là chưa đủ – phải có **dữ liệu chuyến bay của hãng trong DB**.

---

## 3. “Provider” trong nước (Vietnam nội địa) – thực tế

- **Sân bay**: không có API công khai chuẩn; dùng **danh sách chuẩn** (CAAV, IATA) → **data tĩnh**, seed vào DB.
- **Lịch bay / giá**: của từng hãng là **dữ liệu nội bộ**. Không có API miễn phí “lấy lịch hãng X” để hiển thị. Hãng VN (Vietnam Airlines, VietJet, Bamboo…) dùng GDS (Sabre, Amadeus) chủ yếu để **phân phối** (push inventory ra đại lý), không phải để hệ thống của hãng “pull” danh sách chuyến từ GDS.
- **GDS/NDC**: dùng khi hãng muốn **đẩy inventory ra** (bán qua đại lý, OTA). Với hệ thống **bán vé trực tiếp của hãng**, dữ liệu chuyến bay nên **do hãng nhập/quản lý trong DB** (hoặc import từ PSS nội bộ).

**Kết luận**: Ở VN, với mô hình hãng bay riêng, **không có “provider thông dụng” để “lấy chuyến bay real-time hiển thị”** – chuyến bay là data của hãng, nên **lưu và quản lý trong DB**.

---

## 4. Áp dụng vào dự án này

### 4.1. Luồng dữ liệu đề xuất

1. **Seed reference + master (một lần hoặc khi đổi cấu hình)**
   - Currencies, Payment methods, Roles.
   - Cabin/Fare classes, Baggage, Cabin services, Fare description rules.
   - Aircraft types, Aircraft, Seat configurations.
   - **Sân bay VN** (danh sách chuẩn nội địa).
   - **Routes nội địa** (tuyến hãng khai báo).
   - (Tùy chọn) **Flight schedules & instances mẫu** do hãng “tạo” trong hệ thống (script seed nội bộ).

2. **Lịch bay thật (vận hành)**
   - Do **Schedule Planner** tạo/sửa trong admin (Flight schedules, Flight instances) hoặc import từ hệ thống nội bộ.
   - Tất cả **lưu DB**. Trang web tìm chuyến → **đọc từ DB**.

3. **Giá**
   - **RouteFarePrice** do Revenue/Quản lý giá cấu hình → lưu DB. Hiển thị giá khi search từ DB.

4. **Giao dịch**
   - User đặt chỗ → tạo **Reservation/Booking** → **Payment** → **Ticket**. Toàn bộ **lưu DB**.

5. **Provider bên ngoài (Amadeus, v.v.)**
   - **Không dùng** để “lấy chuyến bay hiển thị” trong mô hình hãng bay.
   - Có thể dùng sau này nếu hãng cần **phân phối** (push inventory ra GDS) hoặc **demo** (sync Amadeus test data để thử tích hợp).

### 4.2. Scripts trong repo

| Script | Mục đích | Khi nào dùng |
|--------|----------|----------------|
| `npm run seed:full` | Seed **reference + master tối thiểu** (currency, payment, cabin/fare, baggage, cabin services, fare rules, 1 aircraft type/aircraft/seat config, 1 admin). | Lần đầu setup DB; không tạo sân bay/routes/schedules. |
| `npm run seed:internal-schedule` | Seed **sân bay VN + routes nội địa + flight schedules/instances mẫu** (data “của hãng” trong DB). | Muốn có data nội địa VN để demo/search mà **không** dùng Amadeus. |
| `npm run sync:flight-data` | Sync chuyến bay từ **Amadeus** (test env) vào DB. | Chỉ để **demo/test** API bên ngoài; không phải hướng vận hành chính cho hãng bay. |

### 4.3. Tóm tắt trả lời câu hỏi

- **Lấy data từ provider nào thông dụng trong VN nội địa?**  
  → Với **hãng bay riêng**: không “lấy chuyến bay” từ provider. Sân bay dùng data chuẩn (tĩnh). Lịch/giá là data nội bộ, lưu DB.

- **Real-time hay lưu DB?**  
  → **Lưu DB** cho master + schedule + instances + giá. Availability có thể tính từ DB hoặc từ inventory real-time (tùy quy mô). Giao dịch luôn lưu.

- **Có nên lưu vào bảng không, hay chỉ lấy chuyến bay để hiển thị và chỉ lưu transaction?**  
  → **Nên lưu** schedule/instance/route/price vào DB. Trang web **hiển thị chuyến bay từ DB**. Chỉ lưu transaction là **không đủ** cho mô hình hãng bay.

- **Lấy chuyến bay từ provider hay lấy gì để hiển thị?**  
  → **Không lấy từ provider để hiển thị**. Chuyến bay hiển thị = **đọc từ DB** (dữ liệu do hãng quản lý hoặc seed nội bộ).

---

## 5. Tài liệu liên quan

- [SEED-README.md](./database/SEED-README.md) – Hướng dẫn seed và script liên quan.
- [STRUCTURE.md](./STRUCTURE.md) – Cấu trúc và luồng hệ thống.
- [ROLES_AND_PERMISSIONS.md](./ROLES_AND_PERMISSIONS.md) – Vai trò Schedule Planner, Revenue Analyst, v.v.
