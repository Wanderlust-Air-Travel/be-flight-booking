# Hệ thống Vai trò và Quyền (Roles & Permissions)

## Tổng quan

Hệ thống quản lý đặt vé máy bay sử dụng hệ thống phân quyền dựa trên vai trò (Role-Based Access Control - RBAC) để đảm bảo mỗi người dùng chỉ có quyền truy cập vào các chức năng phù hợp với vai trò của họ.

## Cấu trúc Vai trò

Các vai trò được chia thành **3 nhóm chính**:

### I. Nhóm Người dùng Cuối (End-Users)

#### 1. CUSTOMER - Khách hàng/Hành khách
- **Mô tả**: Vai trò mặc định cho tất cả người dùng
- **Chức năng chính**:
  - Tìm kiếm chuyến bay
  - Đặt vé và thanh toán
  - Quản lý đặt chỗ cá nhân (sửa, hủy)
  - Check-in online
- **Quyền hạn**:
  - `book:create` - Tạo đặt chỗ
  - `book:view-own` - Xem đặt chỗ của mình
  - `book:update-own` - Cập nhật đặt chỗ của mình
  - `book:cancel-own` - Hủy đặt chỗ của mình
  - `reservation:create` - Tạo reservation
  - `reservation:view-own` - Xem reservation của mình
  - `check-in:create` - Tạo check-in
  - `payment:create` - Tạo thanh toán
  - `payment:view-own` - Xem thanh toán của mình

#### 2. TRAVEL_AGENT - Đại lý Du lịch
- **Mô tả**: Đặt chỗ cho nhiều khách hàng, quản lý đặt chỗ nhóm
- **Chức năng chính**:
  - Đặt chỗ cho nhiều khách hàng
  - Quản lý đặt chỗ nhóm
  - Áp dụng giá đại lý
  - Xem báo cáo bán hàng
- **Quyền hạn**:
  - `book:create` - Tạo đặt chỗ
  - `book:view-all` - Xem tất cả đặt chỗ
  - `book:update-all` - Cập nhật tất cả đặt chỗ
  - `book:cancel-all` - Hủy tất cả đặt chỗ
  - `customer:view` - Xem thông tin khách hàng
  - `report:view-sales` - Xem báo cáo bán hàng
  - `pricing:view-agent` - Xem giá đại lý

### II. Nhóm Nghiệp vụ Cốt lõi (Core Operations Staff)

#### 3. SCHEDULE_PLANNER - Quản lý Lịch bay
- **Mô tả**: Tạo, sửa đổi, hủy bỏ các chuyến bay, định nghĩa đường bay và giờ bay
- **Chức năng chính**:
  - Tạo và quản lý lịch chuyến bay
  - Tạo và quản lý chuyến bay thực tế (flight instances)
  - Định nghĩa đường bay và giờ bay
- **Quyền hạn**:
  - `flight-schedule:create` - Tạo lịch chuyến bay
  - `flight-schedule:update` - Cập nhật lịch chuyến bay
  - `flight-schedule:delete` - Xóa lịch chuyến bay
  - `flight-schedule:view` - Xem lịch chuyến bay
  - `flight-instance:create` - Tạo chuyến bay thực tế
  - `flight-instance:update` - Cập nhật chuyến bay thực tế
  - `flight-instance:delete` - Xóa chuyến bay thực tế
  - `flight-instance:view` - Xem chuyến bay thực tế

#### 4. REVENUE_ANALYST - Quản lý Giá vé & Doanh thu
- **Mô tả**: Thiết lập cấu trúc giá vé, hạng đặt chỗ, điều chỉnh giá và số lượng ghế bán (Yield Management)
- **Chức năng chính**:
  - Quản lý hạng vé (fare classes)
  - Thiết lập và điều chỉnh giá
  - Yield management
  - Phân tích doanh thu
- **Quyền hạn**:
  - `fare:create` - Tạo hạng vé
  - `fare:update` - Cập nhật hạng vé
  - `fare:delete` - Xóa hạng vé
  - `fare:view` - Xem hạng vé
  - `pricing:update` - Cập nhật giá
  - `pricing:view` - Xem giá
  - `yield:manage` - Quản lý yield
  - `revenue:view` - Xem doanh thu
  - `revenue:analyze` - Phân tích doanh thu
  - `report:view-revenue` - Xem báo cáo doanh thu

#### 5. ANCILLARY_MANAGER - Quản lý Dịch vụ Phụ trợ
- **Mô tả**: Định nghĩa và cấu hình các dịch vụ bổ sung (hành lý, suất ăn, chỗ ngồi ưu tiên) và thiết lập giá bán
- **Chức năng chính**:
  - Quản lý dịch vụ hành lý
  - Quản lý suất ăn
  - Quản lý chỗ ngồi ưu tiên
  - Thiết lập giá dịch vụ phụ trợ
- **Quyền hạn**:
  - `ancillary:create` - Tạo dịch vụ phụ trợ
  - `ancillary:update` - Cập nhật dịch vụ phụ trợ
  - `ancillary:delete` - Xóa dịch vụ phụ trợ
  - `ancillary:view` - Xem dịch vụ phụ trợ
  - `ancillary:pricing:update` - Cập nhật giá dịch vụ phụ trợ
  - `baggage:manage` - Quản lý hành lý
  - `meal:manage` - Quản lý suất ăn
  - `seat-preference:manage` - Quản lý chỗ ngồi ưu tiên

#### 6. CALL_CENTER - Nhân viên Hỗ trợ/Đặt chỗ
- **Mô tả**: Xử lý các giao dịch phức tạp (hoàn tiền, trao đổi vé), hỗ trợ check-in tại quầy
- **Chức năng chính**:
  - Xử lý hoàn tiền
  - Xử lý trao đổi vé
  - Hỗ trợ check-in tại quầy
  - Xem và cập nhật trạng thái chuyến bay
- **Quyền hạn**:
  - `booking:view-all` - Xem tất cả đặt chỗ
  - `booking:update-all` - Cập nhật tất cả đặt chỗ
  - `booking:cancel-all` - Hủy tất cả đặt chỗ
  - `booking:refund` - Xử lý hoàn tiền
  - `booking:exchange` - Xử lý trao đổi vé
  - `check-in:view-all` - Xem tất cả check-in
  - `check-in:assist` - Hỗ trợ check-in
  - `customer:view` - Xem thông tin khách hàng
  - `customer:update` - Cập nhật thông tin khách hàng
  - `flight-instance:view` - Xem chuyến bay
  - `flight-instance:update-status` - Cập nhật trạng thái chuyến bay
  - `ticket:reissue` - Tái phát hành vé

### III. Nhóm Hỗ trợ & Quản trị (Support & Administration)

#### 7. ADMIN - Quản trị viên Hệ thống
- **Mô tả**: Quản lý toàn bộ hệ thống, cấp phát quyền truy cập, đảm bảo bảo mật và hiệu suất hệ thống
- **Chức năng chính**:
  - Quản lý toàn bộ hệ thống
  - Cấp phát quyền truy cập
  - Quản lý người dùng và vai trò
  - Đảm bảo bảo mật và hiệu suất
- **Quyền hạn**:
  - `*` - Tất cả quyền (full access)

#### 8. ACCOUNTING_STAFF - Chuyên viên Kế toán/Tài chính
- **Mô tả**: Xử lý và đối soát các giao dịch tài chính (hoàn tiền, thanh toán với đại lý), tạo báo cáo tài chính
- **Chức năng chính**:
  - Xử lý hoàn tiền
  - Đối soát giao dịch
  - Thanh toán với đại lý
  - Tạo báo cáo tài chính
- **Quyền hạn**:
  - `booking:view-all` - Xem tất cả đặt chỗ
  - `payment:view-all` - Xem tất cả thanh toán
  - `payment:reconcile` - Đối soát thanh toán
  - `refund:process` - Xử lý hoàn tiền
  - `refund:view-all` - Xem tất cả hoàn tiền
  - `report:view-financial` - Xem báo cáo tài chính
  - `report:view-accounting` - Xem báo cáo kế toán
  - `transaction:view-all` - Xem tất cả giao dịch
  - `transaction:reconcile` - Đối soát giao dịch
  - `agent:settlement` - Thanh toán với đại lý

#### 9. DISTRIBUTION_MANAGER - Quản lý Kênh Phân phối
- **Mô tả**: Quản lý kết nối và đồng bộ hóa thông tin với các hệ thống phân phối toàn cầu (GDS) và đối tác bán lẻ
- **Chức năng chính**:
  - Quản lý kết nối GDS
  - Đồng bộ hóa thông tin
  - Quản lý kênh phân phối
  - Đồng bộ inventory
- **Quyền hạn**:
  - `gds:manage` - Quản lý GDS
  - `gds:sync` - Đồng bộ GDS
  - `distribution:view` - Xem phân phối
  - `distribution:configure` - Cấu hình phân phối
  - `channel:manage` - Quản lý kênh
  - `inventory:sync` - Đồng bộ inventory
  - `fare:view` - Xem giá (để phân phối)
  - `flight-schedule:view` - Xem lịch chuyến bay (để phân phối)

#### 10. FRAUD_ANALYST - Phân tích An ninh & Gian lận
- **Mô tả**: Theo dõi và ngăn chặn các giao dịch đáng ngờ, đảm bảo tuân thủ các quy định bảo mật dữ liệu
- **Chức năng chính**:
  - Phát hiện gian lận
  - Điều tra giao dịch đáng ngờ
  - Chặn tài khoản đáng ngờ
  - Giám sát bảo mật
- **Quyền hạn**:
  - `booking:view-all` - Xem tất cả đặt chỗ
  - `payment:view-all` - Xem tất cả thanh toán
  - `fraud:detect` - Phát hiện gian lận
  - `fraud:investigate` - Điều tra gian lận
  - `fraud:block` - Chặn gian lận
  - `security:monitor` - Giám sát bảo mật
  - `user:view-all` - Xem tất cả người dùng
  - `user:block` - Chặn người dùng
  - `audit:view` - Xem audit log
  - `report:view-security` - Xem báo cáo bảo mật

## Legacy Roles (Để tương thích ngược)

Các roles sau được giữ lại để tương thích ngược với code cũ:

- `FARE_MANAGER` → Sử dụng `REVENUE_ANALYST` thay thế
- `FLIGHT_MANAGER` → Sử dụng `SCHEDULE_PLANNER` thay thế
- `OPERATIONS` → Sử dụng `CALL_CENTER` thay thế
- `SALES` → Sử dụng `TRAVEL_AGENT` thay thế

## Sử dụng trong Code

### Backend (NestJS)

```typescript
import { Roles } from 'src/shared/decorators/roles.decorator';
import { SystemRole } from 'src/shared/constants/roles';
import { RolesGuard } from 'src/shared/guards/roles.guard';
import { UseGuards } from '@nestjs/common';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  @Post('fare-classes')
  @Roles(SystemRole.ADMIN, SystemRole.REVENUE_ANALYST)
  async createFareClass() {
    // Only ADMIN and REVENUE_ANALYST can access
  }
}
```

### Frontend (Next.js)

Frontend có thể kiểm tra roles của user để hiển thị/ẩn các chức năng tương ứng.

## Migration

Để thêm các roles mới vào database, chạy migration:

```bash
npm run migration:run
```

Migration sẽ tự động thêm các roles mới mà không ảnh hưởng đến dữ liệu hiện có.

