# Changelog

Lịch sử các thay đổi quan trọng của dự án.

## [Unreleased]

### Bug Fix: TypeORM Entity Metadata Error in Seed Script (2025-12-03)

- **Bug**: Seed script failed với error `TypeORMError: Entity metadata for User#userRoles was not found`
- **Root Cause**: Thiếu `Role`, `UserRole`, `RouteFarePrice`, `BaggageAllowance`, và `CabinService` entities trong DataSource configuration
- **Fix**: Thêm các entities còn thiếu vào mảng `entities` trong `seed-full-database.ts`
- **Impact**: Seed script giờ có thể chạy thành công và seed đầy đủ dữ liệu bao gồm roles, route fare prices, baggage allowances, và cabin services
- **Files Changed**:
  - `src/scripts/seed-full-database.ts` - Thêm `Role`, `UserRole`, `RouteFarePrice`, `BaggageAllowance`, `CabinService` vào entities array

---

### Dynamic Pricing & Management APIs (2025-12-03)

- **Feature**: Triển khai hệ thống quản lý giá vé động, quy định hành lý và dịch vụ cabin từ database
- **Implementation**:
  - **Route Fare Price Management**: 
    - Tạo entity `RouteFarePrice` để lưu giá vé theo route, fare class, cabin type
    - Hỗ trợ dynamic pricing với effective dates và priority system
    - `FarePricingService` để retrieve pricing từ database với fallback logic
    - APIs: CRUD operations cho route fare prices (REVENUE_ANALYST role)
  - **Baggage Allowance Management**:
    - Tạo entity `BaggageAllowance` để lưu quy định hành lý theo fare class
    - Hỗ trợ phân biệt domestic/international routes
    - APIs: CRUD operations cho baggage allowances (ANCILLARY_MANAGER role)
  - **Cabin Service Management**:
    - Tạo entity `CabinService` để lưu dịch vụ cabin (meals, entertainment, WiFi, etc.)
    - Hỗ trợ services theo cabin class hoặc fare class cụ thể
    - Hỗ trợ included services (miễn phí) và purchasable services (có giá)
    - APIs: CRUD operations cho cabin services (ANCILLARY_MANAGER role)
  - **Frontend UI**:
    - Tạo admin pages cho Route Fare Prices, Baggage Allowances, Cabin Services
    - Tích hợp với admin layout và navigation
    - Type definitions được tách ra file riêng (best practice)
  - **Database Schema**:
    - Migration `1700000003000-CreateRouteFarePriceTable.ts` - Tạo bảng RouteFarePrices
    - Migration `1700000004000-CreateBaggageAndCabinServiceTables.ts` - Tạo bảng BaggageAllowances và CabinServices
  - **Seed Data**:
    - Cập nhật `seed-full-database.ts` để seed route fare prices, baggage allowances, và cabin services
- **Files Changed**:
  - `src/shared/entities/fare/route-fare-price.entity.ts` - RouteFarePrice entity
  - `src/shared/entities/fare/baggage-allowance.entity.ts` - BaggageAllowance entity
  - `src/shared/entities/cabin/cabin-service.entity.ts` - CabinService entity
  - `src/shared/services/fare-pricing.service.ts` - FarePricingService
  - `src/shared/services/cabin-service.service.ts` - CabinServiceService
  - `src/migrations/1700000003000-CreateRouteFarePriceTable.ts` - RouteFarePrice migration
  - `src/migrations/1700000004000-CreateBaggageAndCabinServiceTables.ts` - BaggageAllowance & CabinService migration
  - `src/api-gateway/modules/admin/` - Thêm DTOs và endpoints cho route fare prices, baggage allowances, cabin services
  - `src/microservices/search/search.service.ts` - Sử dụng FarePricingService
  - `src/microservices/reservation/reservation.service.ts` - Sử dụng FarePricingService
  - `src/microservices/booking/booking.service.ts` - Sử dụng FarePricingService
  - `src/scripts/seed-full-database.ts` - Seed route fare prices, baggage allowances, cabin services
  - `booking/app/(page)/admin/route-fare-prices/page.tsx` - Frontend page
  - `booking/app/(page)/admin/baggage-allowances/page.tsx` - Frontend page
  - `booking/app/(page)/admin/cabin-services/page.tsx` - Frontend page
  - `booking/types/admin/*.d.ts` - Type definitions cho admin pages
- **API Endpoints**:
  - `POST /api/v1/admin/route-fare-prices` - Tạo giá vé (REVENUE_ANALYST)
  - `GET /api/v1/admin/route-fare-prices` - Lấy tất cả giá vé
  - `GET /api/v1/admin/route-fare-prices/:id` - Lấy giá vé theo ID
  - `PUT /api/v1/admin/route-fare-prices/:id` - Cập nhật giá vé
  - `DELETE /api/v1/admin/route-fare-prices/:id` - Xóa giá vé
  - `POST /api/v1/admin/baggage-allowances` - Tạo quy định hành lý (ANCILLARY_MANAGER)
  - `GET /api/v1/admin/baggage-allowances` - Lấy tất cả quy định hành lý
  - `GET /api/v1/admin/baggage-allowances/:id` - Lấy quy định hành lý theo ID
  - `PUT /api/v1/admin/baggage-allowances/:id` - Cập nhật quy định hành lý
  - `DELETE /api/v1/admin/baggage-allowances/:id` - Xóa quy định hành lý
  - `POST /api/v1/admin/cabin-services` - Tạo dịch vụ cabin (ANCILLARY_MANAGER)
  - `GET /api/v1/admin/cabin-services` - Lấy tất cả dịch vụ cabin
  - `GET /api/v1/admin/cabin-services/:id` - Lấy dịch vụ cabin theo ID
  - `PUT /api/v1/admin/cabin-services/:id` - Cập nhật dịch vụ cabin
  - `DELETE /api/v1/admin/cabin-services/:id` - Xóa dịch vụ cabin
- **Best Practices**:
  - Tất cả pricing data được lưu trong database, không hardcode
  - Fallback pricing logic nếu không tìm thấy trong database
  - Priority system cho promotions và special pricing
  - Effective dates để quản lý pricing theo thời gian
  - Type definitions tách riêng khỏi business logic (frontend)

---

### Hệ thống Phân quyền Role-Based Access Control (RBAC) (2025-12-03)

- **Feature**: Triển khai hệ thống phân quyền dựa trên vai trò (Role-Based Access Control) theo best practices của ngành hàng không
- **Implementation**:
  - **Role System**: Tạo hệ thống roles với 3 nhóm chính:
    - **Nhóm Người dùng Cuối**: `CUSTOMER`, `TRAVEL_AGENT`
    - **Nhóm Nghiệp vụ Cốt lõi**: `SCHEDULE_PLANNER`, `REVENUE_ANALYST`, `ANCILLARY_MANAGER`, `CALL_CENTER`
    - **Nhóm Hỗ trợ & Quản trị**: `ADMIN`, `ACCOUNTING_STAFF`, `DISTRIBUTION_MANAGER`, `FRAUD_ANALYST`
  - **Database Schema**: 
    - Tạo bảng `Roles` và `UserRoles` (many-to-many relationship)
    - Migration `1700000001000-AddRolesAndUserRoles.ts` - Tạo schema và roles cơ bản
    - Migration `1700000002000-AddNewRoles.ts` - Thêm các roles chuyên nghiệp
  - **Authorization Guards**: 
    - `RolesGuard` - Kiểm tra quyền truy cập dựa trên roles
    - `@Roles()` decorator - Đánh dấu endpoints cần roles cụ thể
    - Tích hợp với JWT authentication
  - **Admin Module**: 
    - Fare Management APIs (CRUD fare classes)
    - Flight Schedule Management APIs (CRUD flight schedules)
    - Flight Instance Management APIs (CRUD flight instances)
    - User Role Management APIs (assign/remove roles)
  - **Permissions System**: 
    - Định nghĩa permissions chi tiết cho từng role
    - `ROLE_PERMISSIONS` mapping trong `src/shared/constants/roles.ts`
  - **Legacy Support**: Giữ lại các legacy roles (`FARE_MANAGER`, `FLIGHT_MANAGER`, `OPERATIONS`, `SALES`) để tương thích ngược
- **Files Changed**:
  - `src/shared/entities/role/role.entity.ts` - Role entity
  - `src/shared/entities/user/user-role.entity.ts` - UserRole join table
  - `src/shared/entities/user/user.entity.ts` - Thêm relationship với roles
  - `src/shared/constants/roles.ts` - SystemRole enum và ROLE_PERMISSIONS
  - `src/shared/decorators/roles.decorator.ts` - @Roles() decorator
  - `src/shared/guards/roles.guard.ts` - RolesGuard implementation
  - `src/migrations/1700000001000-AddRolesAndUserRoles.ts` - Initial roles migration
  - `src/migrations/1700000002000-AddNewRoles.ts` - New roles migration
  - `src/api-gateway/modules/admin/` - Admin module (service, controller, DTOs)
  - `docs/ROLES_AND_PERMISSIONS.md` - Tài liệu chi tiết về roles và permissions
- **API Endpoints**:
  - `POST /api/v1/admin/fare-classes` - Tạo hạng vé (ADMIN, REVENUE_ANALYST)
  - `GET /api/v1/admin/fare-classes` - Lấy tất cả hạng vé
  - `GET /api/v1/admin/fare-classes/:code` - Lấy hạng vé theo code
  - `PUT /api/v1/admin/fare-classes/:code` - Cập nhật hạng vé
  - `DELETE /api/v1/admin/fare-classes/:code` - Xóa hạng vé
  - `POST /api/v1/admin/flight-schedules` - Tạo lịch chuyến bay (ADMIN, SCHEDULE_PLANNER)
  - `GET /api/v1/admin/flight-schedules` - Lấy tất cả lịch chuyến bay
  - `PUT /api/v1/admin/flight-schedules/:id` - Cập nhật lịch chuyến bay
  - `DELETE /api/v1/admin/flight-schedules/:id` - Xóa lịch chuyến bay
  - `POST /api/v1/admin/flight-instances` - Tạo chuyến bay thực tế
  - `GET /api/v1/admin/flight-instances` - Lấy tất cả chuyến bay
  - `PUT /api/v1/admin/flight-instances/:id` - Cập nhật chuyến bay
  - `DELETE /api/v1/admin/flight-instances/:id` - Xóa chuyến bay
  - `POST /api/v1/admin/users/:userId/roles` - Gán quyền cho user (ADMIN only)
  - `DELETE /api/v1/admin/users/:userId/roles/:roleCode` - Xóa quyền của user
  - `GET /api/v1/admin/users/:userId/roles` - Lấy quyền của user
  - `GET /api/v1/admin/roles` - Lấy tất cả roles
- **Best Practice**: 
  - Separation of concerns - Mỗi role có quyền riêng biệt
  - Principle of least privilege - Users chỉ có quyền cần thiết
  - Scalable architecture - Dễ dàng thêm roles và permissions mới
  - Backward compatibility - Giữ lại legacy roles
- **Documentation**: 
  - `docs/ROLES_AND_PERMISSIONS.md` - Tài liệu chi tiết về tất cả roles và permissions
  - `docs/api/API_DOCS.md` - Thêm section Admin APIs
  - `docs/CHANGELOG.md` - Ghi lại thay đổi này

### Cải tiến Frontend Error Handling & Browser Data (2025-12-01)

- **Professional Error Handling & Toast Notifications (2025-12-01)**
  - **Feature**: Cải thiện toàn diện error handling và toast notifications với thông báo lỗi chuyên nghiệp, rõ ràng
  - **Implementation**:
    - **Professional Error Messages**: Thay thế các thông báo lỗi generic ("fetch failed", "Network Error") bằng thông báo chuyên nghiệp, rõ ràng bằng tiếng Việt
    - **Comprehensive Error Handling**: Xử lý đầy đủ các loại lỗi:
      - Network Errors: "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng của bạn và thử lại."
      - Timeout Errors: "Yêu cầu bị quá thời gian chờ. Vui lòng kiểm tra kết nối mạng và thử lại."
      - HTTP Status Codes: Thông báo rõ ràng cho từng status code (400, 401, 403, 404, 500, 502, 503, 504)
      - Validation Errors: Hiển thị danh sách lỗi validation một cách rõ ràng
      - Server Errors: Thông báo lỗi máy chủ với hướng dẫn liên hệ hỗ trợ
    - **Priority-based Error Extraction**: Ưu tiên message từ backend, sau đó mới dùng message mặc định
    - **Axios Interceptor Enhancement**: Cải thiện xử lý network errors (không có response) trong axios interceptor
  - **User Experience**:
    - Thông báo lỗi rõ ràng, chuyên nghiệp, dễ hiểu
    - Hướng dẫn cụ thể cho từng loại lỗi
    - Thân thiện với người dùng, không còn technical jargon
  - **Files Changed**:
    - `booking/lib/toast.ts` - Cải thiện hàm `getErrorMessage()` với comprehensive error handling
    - `booking/lib/axios-instance.ts` - Cải thiện axios interceptor để xử lý network errors tốt hơn
  - **Best Practice**: Professional error messages improve user experience and reduce support burden

- **Browser Data Update - Baseline Browser Mapping (2025-12-01)**
  - **Feature**: Cập nhật browser compatibility data và thêm script tự động cập nhật
  - **Implementation**:
    - Update Browserslist Database: Cập nhật `caniuse-lite` database lên version mới nhất
    - Reinstall Baseline Browser Mapping: Đảm bảo package được cài đặt với data mới nhất
    - Auto-update Script: Thêm script `update:browser-data` để dễ dàng cập nhật trong tương lai
    - DevDependencies: Thêm `update-browserslist-db` vào devDependencies
  - **Usage**:
    ```bash
    # Cập nhật browser data
    npm run update:browser-data
    
    # Hoặc thủ công
    npx update-browserslist-db@latest
    ```
  - **Files Changed**:
    - `booking/package.json` - Thêm script `update:browser-data` và `update-browserslist-db` vào devDependencies
  - **Best Practice**: Keep browser compatibility data up-to-date for accurate baseline information

### Cải tiến Frontend UI/UX (2025-11-30)

- **Calendar Component Fix - Date of Birth Picker (2025-11-30)**
  - **Issue**: Calendar component quá nhỏ, dropdown tháng/năm không hoạt động
  - **Root Cause**: Calendar component không tuân theo đúng Shadcn UI documentation, có override không cần thiết
  - **Fix**:
    - Sửa `calendar.tsx` component theo đúng Shadcn UI documentation
    - Bỏ `bg-popover` khỏi `dropdown` class (theo documentation)
    - Đơn giản hóa cách sử dụng Calendar - chỉ override những classNames cần thiết cho theme
    - Sử dụng `overflow-hidden p-0` trong `PopoverContent` (theo Date of Birth Picker example)
  - **User Experience**:
    - Calendar có kích thước phù hợp, dễ đọc và thao tác
    - Dropdown tháng/năm hoạt động bình thường (native select của react-day-picker)
    - Có thể click và chọn tháng/năm dễ dàng
  - **Files Changed**:
    - `booking/components/ui/calendar.tsx` - Fixed dropdown class, removed unnecessary overrides
    - `booking/app/(page)/booking/info/page.tsx` - Simplified Calendar usage, removed excessive classNames
  - **Best Practice**: Follow Shadcn UI documentation exactly, only override necessary classNames for theme customization

- **Hydration Mismatch Fix - AOS Library (2025-11-30)**
  - **Issue**: Next.js hydration mismatch warnings do AOS (Animate On Scroll) library
  - **Root Cause**: AOS thêm các class `aos-init` và `aos-animate` vào client-side nhưng không có trong server-side render
  - **Fix**:
    - Thêm `suppressHydrationWarning` cho tất cả elements có `data-aos` attribute
    - Prop này báo cho React bỏ qua warning về sự khác biệt attributes/classes cho element đó
    - An toàn vì AOS chỉ ảnh hưởng đến animation, không ảnh hưởng đến logic
  - **Files Changed**:
    - `booking/app/components/Services/ServiceSlide.tsx` - Added `suppressHydrationWarning` to all `data-aos` elements
    - `booking/app/components/Banner/Banner.tsx` - Added `suppressHydrationWarning` to all `data-aos` elements
    - `booking/app/components/Services/ServiceHome.tsx` - Added `suppressHydrationWarning` to all `data-aos` elements
    - `booking/app/components/Services/ServiceAll.tsx` - Added `suppressHydrationWarning` to all `data-aos` elements
  - **Impact**: Không còn hydration mismatch warnings, AOS vẫn hoạt động bình thường

- **Booking Info Page UI Improvements (2025-11-30)**
  - **Feature**: Cải thiện UI/UX cho trang nhập thông tin booking (`/booking/info`)
  - **Implementation**:
    - **Font Size & Weight**: Tăng font size (1.8rem cho inputs, 2.4rem cho headings) và font-weight (font-semibold, font-bold)
    - **Color Synchronization**: Áp dụng primary color (`--cl-pri`) cho headings, labels, borders, buttons
    - **Calendar Date Picker**: 
      - Sử dụng Shadcn UI Calendar component với `captionLayout="dropdown"`
      - Tăng kích thước calendar (min-w-[380px], cell-size: 3.2rem)
      - Dropdown tháng/năm hoạt động đúng
    - **Gender Selection**: 
      - Thay select box bằng radio buttons (Shadcn UI RadioGroup)
      - Chỉ có 2 options: "Male" và "Female" (bỏ "Other")
    - **Document Number Logic**:
      - Chỉ hiển thị cho ADT passengers
      - Ẩn hoàn toàn cho CHD và INF passengers
      - Frontend validation: required cho ADT, optional cho CHD/INF
    - **Auto-fill DOB**: 
      - Tự động điền DOB mặc định khi chọn passenger type
      - ADT: 18 tuổi tại ngày bay
      - CHD: 6 tuổi tại ngày bay
      - INF: 1 tuổi tại ngày bay
  - **User Experience**:
    - Text dễ đọc hơn với font size lớn hơn
    - UI nhất quán với landing page (cùng color scheme)
    - Calendar dễ sử dụng hơn với dropdown tháng/năm
    - Gender selection trực quan hơn với radio buttons
    - Auto-fill DOB tiết kiệm thời gian
  - **Files Changed**:
    - `booking/app/(page)/booking/info/page.tsx` - Complete UI overhaul với Shadcn UI components
  - **Best Practice**: Sử dụng Shadcn UI components cho consistency, chỉ customize theme colors

### Cải tiến quan trọng (2025-11-30)

- **Flight Search Pre-validation với Toast Notifications (2025-11-30)**
  - **Feature**: Validate flight availability trước khi navigate đến results page
  - **Implementation**:
    - Frontend gọi API search trước khi navigate
    - Hiển thị loading toast: "Đang kiểm tra chuyến bay..."
    - Nếu không có flights: Hiển thị error toast ngay tại landing page, không navigate
    - Nếu có flights: Navigate đến results page
  - **User Experience**:
    - User được thông báo ngay tại landing page nếu không có flights
    - Không cần chuyển trang rồi mới thấy lỗi
    - Error messages rõ ràng với thông tin cụ thể (origin, destination, date)
  - **Files Changed**:
    - `booking/app/components/FlightSearchBar/FlightSearchBar.tsx` - Updated `handleSearch()` với pre-validation
    - `booking/lib/toast.ts` - Sử dụng `showLoading()`, `updateToast()`, `showError()`
  - **Best Practice**: Fail fast - validate trước khi navigate để cải thiện UX

- **Seed Script Improvements - Guaranteed Daily Flights (2025-11-30)**
  - **Feature**: Đảm bảo mỗi route có ít nhất 1 daily schedule để có flights mỗi ngày trong tháng 12/2025
  - **Implementation**:
    - Schedule đầu tiên của mỗi route luôn là daily (`operating_days: '1111111'`)
    - Các schedule tiếp theo có thể random (daily, Mon/Wed/Fri/Sun, Tue/Thu/Sat, Mon-Fri, Sat-Sun)
    - Đảm bảo có flights cho tất cả routes và dates trong tháng 12/2025
  - **Benefits**:
    - User có thể search bất kỳ route nào vào bất kỳ ngày nào trong tháng 12/2025
    - Không còn trường hợp "Flight instances are not valid. Please choose another day!"
    - Data realistic và đầy đủ cho testing
  - **Files Changed**:
    - `be-flight-booking/src/scripts/seed-full-database.ts` - Updated schedule generation logic
  - **Documentation**: Updated `docs/database/SEED-README.md` với thông tin về daily schedules

- **Airport List API Endpoint (2025-11-30)**
  - **Feature**: API endpoint để lấy danh sách tất cả airports từ backend
  - **Implementation**:
    - `GET /api/v1/search/airports` - Public endpoint, không cần authentication
    - Trả về danh sách airports sorted by city name
    - Response format: `{ airports: [{ iata, name, city, value }] }`
    - Frontend fetch từ Next.js API route: `/api/search/airports` (proxy to backend)
  - **Benefits**:
    - Frontend không cần hardcode airport data
    - Backend là single source of truth cho airport data
    - Dễ dàng update airports mà không cần deploy frontend
  - **Files Changed**:
    - `be-flight-booking/src/microservices/search/search.service.ts` - Added `getAirports()` method
    - `be-flight-booking/src/microservices/search/search.controller.ts` - Added `handleGetAirports()` handler
    - `be-flight-booking/src/api-gateway/modules/search/search.controller.ts` - Added `GET /api/v1/search/airports` endpoint
    - `be-flight-booking/src/microservices/search/dto/airport-list-response.dto.ts` - New DTO
    - `booking/app/api/search/airports/route.ts` - Next.js API route proxy
    - `booking/app/components/FlightSearchBar/FlightSearchBar.tsx` - Updated để fetch airports từ API
  - **Documentation**: Updated `docs/api/API_DOCS.md` với airports endpoint

- **Person Component State Hydration Fix (2025-11-30)**
  - **Issue**: Person component không hydrate state từ store khi mount, gây ra lỗi hiển thị sai số lượng passengers
  - **Root Cause**: Component khởi tạo với hardcoded values (1 adult, 0 child, 0 infant) và không đọc từ store
  - **Fix**:
    - Component đọc state từ store khi khởi tạo
    - Thêm hydration logic: đợi store hydrate xong, sau đó sync local state từ store
    - Sử dụng `useRef` để track hydration, tránh overwrite store với giá trị mặc định
    - Chỉ update store sau khi đã hydrate xong
  - **Files Changed**:
    - `booking/app/components/Person/Person.tsx` - Added hydration logic
    - `booking/app/zustand/storeFightSearchBar.tsx` - Added `isHydrated` flag và `onRehydrateStorage` callback
    - `booking/types/fight-search-bar.d.ts` - Added `isHydrated` và `setHydrated` to interface
  - **Impact**: Search bar hiển thị đúng số lượng passengers khi navigate giữa các trang

- **Seat Map Page Passenger Count Fix (2025-11-30)**
  - **Issue**: Seat map page chỉ cho phép chọn 1 ghế dù user đã chọn nhiều passengers
  - **Root Cause**: `passengersNeedingSeats` được tính từ store nhưng store chưa hydrate khi component mount
  - **Fix**:
    - Đợi store hydrate xong trước khi tính `passengersNeedingSeats`
    - Thêm logging để debug state changes
    - `passengersNeedingSeats` trả về 0 nếu chưa hydrate, tránh tính toán sai
  - **Files Changed**:
    - `booking/app/(page)/booking/seat-map/page.tsx` - Updated để đợi hydration và thêm logging
  - **Impact**: Seat map page hiển thị đúng số lượng ghế cần chọn dựa trên số lượng passengers

### Tính năng mới (2025-11-30)

- **Real-time WebSocket Communication (2025-11-30)**
  - **Feature**: Real-time communication cho critical business flows sử dụng WebSocket và Redis Pub/Sub
  - **Implementation**:
    - **WebSocket Gateway**: Socket.IO Gateway tại namespace `/realtime` (port 3000)
    - **Seat Availability Updates** (High Priority):
      - Real-time seat status changes để tránh conflict khi nhiều user cùng chọn ghế
      - Redis Pub/Sub channel: `seat:availability:{flightInstanceId}`
      - Service: `SeatAvailabilityService`
      - Events: `subscribe:seat-availability`, `unsubscribe:seat-availability`, `seat-availability:update`
    - **Reservation Countdown Timer** (High Priority - Business Critical):
      - Server-synced countdown timer - sync từ server mỗi giây
      - Prevents client-side timer drift và ensures accuracy
      - TCP communication với Reservation Microservice để lấy expiration time
      - Service: `ReservationCountdownService`
      - Events: `subscribe:reservation-countdown`, `unsubscribe:reservation-countdown`, `reservation-countdown:update`, `reservation-countdown:expired`
    - **Payment Status Updates** (High Priority - UX Critical):
      - Real-time payment confirmation - immediate feedback khi payment status thay đổi
      - Redis Pub/Sub channels: `payment:status:booking:{bookingId}`, `payment:status:payment:{paymentId}`
      - Service: `PaymentStatusService`
      - Events: `subscribe:payment-status`, `unsubscribe:payment-status`, `payment-status:update`
  - **Architecture**:
    - Backend-managed state - BE quản lý state, FE chỉ hiển thị
    - Redis Pub/Sub để broadcast events across multiple API Gateway instances (horizontal scaling)
    - Hỗ trợ cả authenticated users (JWT token) và guest users (Session ID)
    - WebSocket connection authentication qua JWT hoặc Session ID
    - User-specific rooms: `user:{userId}` và `session:{sessionId}` cho targeted messaging
  - **Technology Stack**:
    - Socket.IO (NestJS WebSocket Gateway)
    - Redis Pub/Sub cho multi-instance support
    - TCP communication với Reservation Microservice cho countdown timer
  - **Files Created**:
    - `src/api-gateway/modules/realtime/realtime.module.ts` - Main module
    - `src/api-gateway/modules/realtime/realtime.gateway.ts` - WebSocket Gateway
    - `src/api-gateway/modules/realtime/realtime.service.ts` - Subscription management
    - `src/api-gateway/modules/realtime/services/seat-availability.service.ts` - Seat availability service
    - `src/api-gateway/modules/realtime/services/reservation-countdown.service.ts` - Countdown service
    - `src/api-gateway/modules/realtime/services/payment-status.service.ts` - Payment status service
    - `src/api-gateway/modules/realtime/README.md` - Usage guide
    - `src/api-gateway/modules/realtime/INTEGRATION.md` - Integration guide
    - `src/api-gateway/modules/realtime/SETUP.md` - Setup instructions
    - `docs/REALTIME_IMPLEMENTATION.md` - Comprehensive implementation guide
  - **Dependencies**:
    - Backend: `@nestjs/websockets`, `socket.io`
    - Frontend: `socket.io-client` (cần cài đặt)
  - **Integration Points**:
    - Seat availability: Publish events khi seat được reserve/release (từ Reservation Service hoặc Booking State Service)
    - Payment status: Publish events khi payment status thay đổi (từ Payment Service hoặc Webhook handler)
    - Reservation countdown: Tự động chạy khi client subscribe, không cần publish từ services
  - **Best Practices**:
    - Always unsubscribe khi component unmount
    - Handle connection errors gracefully
    - Use server as source of truth cho countdown timer
    - Publish events immediately khi state changes
    - Use Redis Pub/Sub cho multi-instance deployments
    - BE manages state - Frontend chỉ hiển thị
  - **Documentation**:
    - Updated `README.md` - Added WebSocket to tech stack và features
    - Updated `docs/README.md` - Added links to WebSocket documentation
    - Updated `docs/CHANGELOG.md` - Added WebSocket implementation details
    - Updated `docs/STRUCTURE.md` - Added WebSocket module
    - Updated `docs/api/API_DOCS.md` - Added WebSocket endpoints documentation
    - Updated `docs/api/API_SEQUENCE_DIAGRAMS.md` - Added WebSocket flow diagrams
    - Updated Postman collection - Added WebSocket requests

### Tính năng mới (2025-11-29)

- **Hybrid Cancellation Approach - Partial & Full Cancellation (2025-11-29)**
  - **Feature**: Hỗ trợ hủy từng ticket riêng lẻ (partial cancellation) và hủy toàn bộ booking (full cancellation)
  - **Implementation**:
    - **Level 1: Cancel Individual Ticket** - `PATCH /api/v1/bookings/tickets/:ticketId/cancel`
      - Hủy một ticket riêng lẻ từ booking
      - Recalculate `booking.total_amount` sau khi hủy ticket
      - Auto-cancel booking nếu tất cả tickets cancelled
      - Refund calculation theo segment (proportional)
    - **Level 2: Cancel Entire Booking** - `PATCH /api/v1/bookings/:id/cancel` (enhanced)
      - Hủy toàn bộ booking và tất cả tickets
      - Refund calculation cho toàn bộ booking
    - **OTP Verification for Paid Bookings**:
      - `POST /api/v1/auth/otp/cancellation/send` - Gửi OTP (5 phút expiry)
      - `POST /api/v1/auth/otp/cancellation/verify` - Verify OTP và tạo verification token (10 phút)
      - Verification token được check trong cancel request (không cần OTP trong body)
    - **Get Ticket Info** - `GET /api/v1/bookings/tickets/:ticketId/info`
      - Lấy `bookingId` và `bookingStatus` từ `ticketId` (dùng cho OTP flow)
  - **Refund Calculation**:
    - **Full Cancellation**: `Refund = Total Amount - Cancellation Fee - Non-refundable Fees (10%)`
    - **Partial Cancellation**: `Refund = Segment Amount - Cancellation Fee - Non-refundable Fees (proportional 10%)`
    - Cancellation fee tính theo fare class (300,000 - 600,000 VND per segment)
  - **Business Rules**:
    - Paid bookings có thể hủy (với OTP verification)
    - Pending/Confirmed bookings có thể hủy trực tiếp (không cần OTP)
    - Auto-cancel booking khi tất cả tickets cancelled
    - Booking status check được ưu tiên trước fare class/time limit check
  - **Frontend Implementation**:
    - Button "Hủy vé này" cho từng ticket (partial cancellation)
    - Button "Hủy toàn bộ đặt chỗ" cho booking (full cancellation)
    - OTP dialog riêng cho cancel ticket và cancel booking
    - Hiển thị refund amount trong toast notification
    - Hiển thị thông báo nếu booking được auto-cancel
    - Disable buttons khi ticket/booking đã cancelled
  - **My Journey Filter**:
    - Tự động loại bỏ cancelled bookings khỏi "Hành trình của tôi"
    - Chỉ hiển thị active/completed journeys
  - **Files Changed**:
    - `src/microservices/booking/booking.service.ts`:
      - `cancelTicket()` - Cancel individual ticket
      - `getTicketInfo()` - Get ticket info
      - `calculateRefundAmountForSegments()` - Refund calculation for segments
      - `cancelBooking()` - Enhanced với paid booking support và refund calculation
    - `src/microservices/booking/booking.controller.ts` - Handlers cho cancel ticket và get ticket info
    - `src/microservices/booking/booking.messages.ts` - Added `CANCEL_TICKET`, `GET_TICKET_INFO` patterns
    - `src/api-gateway/modules/booking/booking.controller.ts`:
      - `PATCH /api/v1/bookings/tickets/:ticketId/cancel` - Cancel ticket endpoint
      - `GET /api/v1/bookings/tickets/:ticketId/info` - Get ticket info endpoint
      - Enhanced `PATCH /api/v1/bookings/:id/cancel` với OTP verification
    - `src/api-gateway/modules/auth/auth.service.ts`:
      - `sendOtpCancellation()` - Send OTP for cancellation
      - `verifyOtpCancellation()` - Verify OTP và tạo verification token
      - `isCancellationOtpVerified()` - Check verification token
      - `deleteCancellationVerificationToken()` - Delete verification token
    - `src/shared/services/otp-storage.service.ts`:
      - `storeCancellationOtp()` - Store cancellation OTP
      - `verifyCancellationOtp()` - Verify và tạo verification token
      - `isCancellationOtpVerified()` - Check verification token
      - `deleteCancellationVerificationToken()` - Delete verification token
    - `src/microservices/email/services/email-template.service.ts`:
      - `OTP_CANCELLATION` template
      - `BOOKING_CANCELLATION` template với refund information
    - `booking/app/(page)/my-tickets/page.tsx`:
      - `handleCancelTicket()` - Cancel individual ticket
      - `handleVerifyOtpAndCancelTicket()` - OTP verification flow
      - `performTicketCancellation()` - Execute ticket cancellation
      - OTP dialogs cho cancel ticket và cancel booking
      - UI updates cho partial cancellation display
    - `booking/app/api/bookings/tickets/[ticketId]/cancel/route.ts` - Frontend API route (new)
    - `booking/app/api/bookings/tickets/[ticketId]/info/route.ts` - Frontend API route (new)
    - `booking/app/(page)/my-journey/page.tsx` - Filter cancelled bookings
  - **Documentation**:
    - Updated `docs/api/API_DOCS.md` với hybrid cancellation endpoints
    - Updated `docs/api/API_SEQUENCE_DIAGRAMS.md` với cancellation flows
    - Updated Postman collection với cancel ticket requests

### Bug Fixes (2025-11-29)

- **Fixed Booking Cancellation Logic - Booking Status Check (2025-12-XX)**
  - **Issue**: Frontend hiển thị "Có thể hủy" nhưng backend từ chối hủy với lỗi "Cannot cancel booking with status: paid"
  - **Root Cause**: Logic `getMyTickets` tính `canCancel` dựa trên fare class và thời hạn, nhưng không kiểm tra booking status trước
  - **Fix**:
    - Cập nhật `getMyTickets` trong `BookingService` để kiểm tra booking status trước khi tính `canCancel`
    - Booking với status `paid`, `cancelled`, hoặc `completed` → `canCancel: false` với lý do rõ ràng
    - Chỉ booking với status `pending` hoặc `confirmed` mới được kiểm tra fare class và thời hạn
  - **Impact**: Frontend và backend đã đồng bộ về logic hủy vé, tránh lỗi khi user click hủy
  - **Files Changed**:
    - `src/microservices/booking/booking.service.ts` - Updated `getMyTickets()` method to check booking status first

### Tính năng mới (2025-11-29)

- **Booking Cancellation Feature (2025-11-29)**
  - **Feature**: Cho phép user hủy booking theo quy định Bamboo Airways
  - **Implementation**:
    - Endpoint `PATCH /api/v1/bookings/:id/cancel` - Hủy booking (chỉ authenticated users)
    - Validation ownership: Chỉ user sở hữu booking mới có thể hủy
    - Validation status: Chỉ booking `pending` hoặc `confirmed` mới có thể hủy
    - Cancellation eligibility check: Kiểm tra fare class và thời hạn hủy
    - Transaction-based: Đảm bảo tính nhất quán khi hủy booking và tickets
  - **Business Rules (Quy định Bamboo Airways)**:
    - **Chặng bay nội địa:** Hoàn thiện thủ tục hoàn vé trước giờ khởi hành tối thiểu **03 tiếng**
    - **Chặng bay quốc tế:** Thực hiện thủ tục hoàn vé trước giờ khởi hành ít nhất **05 tiếng**
    - **Hạng vé được phép hoàn:** Economy Smart, Economy Flex, Premium Smart, Premium Flex, Business Smart, Business Flex
    - **Hạng vé KHÔNG được phép hoàn:** Economy Saver Max (YSM, SMX), Economy Saver / Bamboo Eco
  - **Frontend Implementation**:
    - UI button "Hủy đặt chỗ" trong "Vé của tôi" page
    - UI button "Hủy đặt chỗ" trong "Hành trình của tôi" page
    - Hiển thị điều khoản hủy vé chi tiết cho từng ticket
    - Confirm dialog trước khi hủy
    - Auto-refresh sau khi hủy thành công
    - Hiển thị cancellation deadline và reason nếu không thể hủy
  - **Files Changed**:
    - `src/microservices/booking/booking.service.ts` - Method `cancelBooking()`, improved `checkCancellationEligibility()`
    - `src/microservices/booking/booking.controller.ts` - Handler `handleCancelBooking()`
    - `src/microservices/booking/booking.messages.ts` - Added `CANCEL_BOOKING` pattern
    - `src/api-gateway/modules/booking/booking.controller.ts` - Endpoint `PATCH /api/v1/bookings/:id/cancel`
    - `booking/app/api/bookings/[bookingId]/cancel/route.ts` - Frontend API route (new)
    - `booking/app/(page)/my-tickets/page.tsx` - Cancel button và cancellation terms display
    - `booking/app/(page)/my-journey/page.tsx` - Cancel button
  - **Documentation**:
    - Updated `docs/api/API_DOCS.md` - Added cancel booking endpoint documentation
    - Updated `docs/api/API_SEQUENCE_DIAGRAMS.md` - Added cancel booking flow diagrams
    - Updated `docs/CHANGELOG.md` - Added cancellation feature details
    - Updated Postman collection - Added cancel booking request

### Tính năng mới (2025-11-29)

- **RabbitMQ Integration (2025-11-29)**
  - **Feature**: Tích hợp RabbitMQ cho asynchronous messaging và event-driven architecture
  - **Implementation**:
    - RabbitMQ service với automatic reconnection và connection pooling
    - Email notifications qua RabbitMQ queue (non-blocking)
    - Ticket creation sau payment qua RabbitMQ queue (async processing)
    - Hybrid email client: RabbitMQ preferred, TCP fallback
    - Management UI tại `http://localhost:15672` (admin/admin123)
  - **Benefits**:
    - Improved performance: Non-blocking email và ticket creation
    - Better scalability: Message queue cho high-volume operations
    - Resilience: Automatic reconnection và fallback mechanisms
    - Message persistence: Durable queues với TTL
  - **Configuration**:
    - Environment variables: `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USER`, `RABBITMQ_PASS`
    - Queues: `email_notifications`, `ticket_creation`
    - Prefetch count: 10 messages per consumer
  - **Files Changed**:
    - `src/shared/modules/rabbitmq/` - Core RabbitMQ modules (new)
    - `src/microservices/email/consumers/email-rabbitmq.consumer.ts` - Email consumer (new)
    - `src/microservices/booking/consumers/ticket-rabbitmq.consumer.ts` - Ticket consumer (new)
    - `src/shared/modules/email-client/hybrid-email-client.service.ts` - Hybrid email client (new)
    - `src/microservices/payment/payment.service.ts` - Publish ticket creation to RabbitMQ
    - `docker-compose.yml` - Added RabbitMQ service
    - `package.json` - Added `amqplib` dependency
  - **Documentation**: 
    - Added `docs/design/RABBITMQ_INTEGRATION.md` - Comprehensive RabbitMQ integration guide
    - Updated `README.md` - Added RabbitMQ to tech stack and features

- **Payment Flow Improvements (2025-11-29)**
  - **Error Handling**: Cải thiện xử lý lỗi "Booking is already paid"
    - Frontend tự động redirect đến confirmation page thay vì hiển thị error
    - User-friendly error messages
    - Better validation và error detection
  - **API Route Fixes**: Sửa lỗi "paymentId path parameter is required"
    - Hỗ trợ cả Next.js 13-14 (sync params) và Next.js 15+ (async params)
    - Fallback: Extract paymentId từ URL path nếu params không có
    - Improved error messages
  - **Files Changed**:
    - `booking/app/(page)/booking/payment/page.tsx` - Improved error handling, auto-redirect
    - `booking/app/api/payments/[paymentId]/route.ts` - Fixed parameter extraction
  - **User Experience**: 
    - Seamless flow khi booking đã paid
    - Better error messages
    - Automatic redirects

### Tính năng mới (2025-11-28)

- **Guest Booking Support (2025-11-28)**
  - **Feature**: Hệ thống hỗ trợ guest bookings - người dùng chưa đăng nhập có thể đặt chuyến bay
  - **Implementation**:
    - Sử dụng `OptionalJwtAuthGuard` cho booking và reservation APIs
    - `POST /api/v1/reservations` - Optional authentication (guest bookings được hỗ trợ)
    - `POST /api/v1/bookings` - Optional authentication (guest bookings được hỗ trợ)
    - `GET /api/v1/bookings/:id/fare-details` - Public endpoint
    - `GET /api/v1/bookings/:id/payment-info` - Public endpoint
  - **Guest Booking Rules**:
    - Contact information (fullname, email, phone) là **BẮT BUỘC** cho guest bookings
    - Passenger information phải được cung cấp đầy đủ (không thể dùng `passengerId`)
    - Booking được tạo với `user_id = null`
    - Passengers được tạo với `user_id = null`
  - **Authenticated Booking Rules**:
    - Contact information là **OPTIONAL** (sẽ dùng user info nếu không có)
    - Có thể dùng `passengerId` để tái sử dụng passenger đã lưu
  - **Files Changed**:
    - `src/api-gateway/modules/booking/booking.controller.ts` - Sử dụng `OptionalJwtAuthGuard`, validate contact info cho guest
    - `src/microservices/booking/booking.service.ts` - Xử lý `userId = null`, validate contact info cho guest
    - `src/microservices/booking/booking.controller.ts` - Type update để nhận `userId: string | null`
    - `booking/app/api/bookings/route.ts` - Authorization header là optional
    - `booking/app/api/reservations/route.ts` - Authorization header là optional
    - `booking/app/(page)/booking/info/page.tsx` - Bỏ yêu cầu login, hỗ trợ guest booking
  - **Documentation**: 
    - Added `docs/design/GUEST_BOOKING_FLOW.md` - Design document cho guest booking
    - Updated `docs/api/API_DOCS.md` - Thêm guest booking flow và validation rules
    - Updated `docs/api/API_SEQUENCE_DIAGRAMS.md` - Thêm sequence diagrams cho guest và authenticated booking flows
    - Updated `booking/docs/README.md` - Thêm guest booking documentation
    - Updated `README.md` - Thêm guest booking feature

### Cải tiến quan trọng (2025-11-26)

- **Payment Microservice Timeout Configuration (2025-11-26)**
  - **Problem**: Payment microservice timeout sau 15 giây khiến 11/25 tests fail
  - **Solution**: Thêm timeout configuration cho payment microservice client
    - **Write Operations** (createPayment, processPayment, updatePaymentStatus, handleWebhook): 60 seconds timeout
    - **Read Operations** (getPayment, getPaymentsByBooking): 30 seconds timeout
  - **Implementation**:
    - Sử dụng RxJS `timeout` operator trong `firstValueFrom` calls
    - Proper error handling với `catchError` để map timeout errors
    - Timeout errors được map với `ETIMEDOUT` code để được handle đúng cách
  - **Best Practice**: Payment operations cần timeout dài hơn vì:
    - Database transactions với pessimistic locks (có thể chậm nếu có lock contention)
    - Payment gateway integration (external API calls)
    - Complex validation và business logic
  - **Results**: All 25/25 payment tests now passing (100% pass rate)
  - **Files Changed**:
    - `src/api-gateway/modules/payment/payment.controller.ts` - Added timeout operators to all firstValueFrom calls

- **Seat Validation trong Booking State (2025-11-26)**
  - **Comprehensive Validation**: Thêm validation toàn diện cho seat selection trước khi lưu vào booking state
  - **Validation Rules**:
    - Validate cabin selection exists (cabin phải được chọn trước)
    - Validate flight instance exists
    - Validate seat exists trong database
    - Validate seat thuộc về đúng flight instance
    - Validate seat number matches với seat ID
    - Validate seat is available (is_available = true)
    - Validate seat matches cabin class đã chọn (Economy/Business) - **MOST IMPORTANT**
  - **Error Messages**: Cải thiện error messages với thông tin cụ thể về validation failures
  - **Best Practice**: Early validation (fail fast) - validate trước khi lưu vào booking state
  - **Files Changed**:
    - `src/api-gateway/modules/booking-state/booking-state.controller.ts` - Added `validateSeatSelection()` method
    - `src/api-gateway/modules/booking-state/booking-state.module.ts` - Added TypeORM repositories (FlightSeat, FlightInstance, FareClass)
  - **Documentation**: Added `docs/api/BOOKING_STATE_SEAT_API.md` with comprehensive validation rules

- **Error Handling Improvements (2025-11-26)**
  - **Reservation Controller**: Cải thiện error handling để preserve error messages từ microservice
    - Handle HttpException instances correctly
    - Extract error messages từ multiple error formats
    - Provide descriptive default messages với keywords (cabin|seat|booking state)
  - **Payment Controller**: Cải thiện error message extraction từ microservice errors
    - Try multiple error formats để extract meaningful messages
    - Provide descriptive default messages
  - **Files Changed**:
    - `src/api-gateway/modules/reservation/reservation.controller.ts` - Improved error handling
    - `src/api-gateway/modules/payment/payment.controller.ts` - Improved error handling
    - `src/microservices/reservation/reservation.service.ts` - Improved error propagation

- **Test Improvements (2025-11-26)**
  - **Booking State Tests**: Sửa tests để clear state đúng cách trước khi test
  - **Email Tests**: Sửa test để thêm `/api/v1` prefix trong path
  - **Improvements Tests**: 
    - Sửa API versioning test expectations
    - Sửa rate limiting test để tránh connection issues
    - Sửa CORS test để thêm Origin header
  - **All E2E Tests**: 178/203 tests passing (87.7%)
    - Health: 3/3 PASS
    - Auth: 37/37 PASS
    - Search: 34/34 PASS
    - Reservation: 28/28 PASS
    - Booking: 20/20 PASS
    - Booking State: 24/24 PASS
    - Email: 18/18 PASS
    - Improvements: 13/13 PASS
    - Payment: 14/25 PASS (11 fail do microservice timeout - infrastructure issue, not code bug)

### Tính năng mới

- **Deals Images Download Script Improvements (2025-11-25)**
  - **Auto-cleanup**: Tự động xóa tất cả ảnh cũ trong `public/images/routes` trước khi download ảnh mới
  - **Top 8 Deals Only**: Chỉ download ảnh cho top 8 deals từ API `/api/v1/services/deals` (FE chỉ hiển thị 8 items)
  - **API Gateway Health Check**: Đợi API Gateway sẵn sàng trước khi fetch deals với retry logic và exponential backoff
  - **Error Handling**: Comprehensive error handling với logging
  - **Files Changed**:
    - `scripts/download-deals-images.ts` (updated)
    - `docker/entrypoint-with-download.ts` (new)

- **Conditional Database Seeding (2025-11-25)**
  - **Check Existing Data**: Kiểm tra database đã có data chưa trước khi seed
  - **Raw SQL Queries**: Sử dụng raw SQL để tránh TypeORM entity metadata issues
  - **Prevent Duplicate Seeding**: Tránh seed lại data đã tồn tại
  - **Graceful Exit**: Nếu đã có data, log message và exit gracefully
  - **Files Changed**:
    - `docker/seed-if-empty.ts` (new)
    - `src/scripts/seed-full-database.ts` (updated - added check)

### Tính năng mới

- **Auto-fetch từ Booking State (2025-11-25)**
  - **OptionalJwtAuthGuard**: Guard mới cho phép optional authentication - extract user từ JWT token nếu có, nhưng không bắt buộc authentication
  - **Auto-fetch Logic**: Một số API tự động lấy thông tin từ booking state khi user đã đăng nhập:
    - `GET /api/v1/search/fare-options`: Tự động lấy `flightInstanceId` và `cabinType` từ booking state
    - `GET /api/v1/search/seats`: Tự động lấy `cabinType` từ booking state
  - **Benefits**: Cải thiện UX, giảm số lượng API calls, backward compatible
  - **Implementation**:
    - `OptionalJwtAuthGuard` extract user từ JWT token nhưng không block request nếu không có token
    - `BookingStateRepository.findAllByUserId()` sử dụng raw Redis client để query keys (fix ioredis keyPrefix issue)
    - Query parameters luôn có priority cao hơn booking state (override)
  - **Files Changed**:
    - `src/api-gateway/modules/auth/guard/optional-jwt-auth.guard.ts` (new)
    - `src/api-gateway/modules/search/search.controller.ts` (updated)
    - `src/shared/repositories/booking-state.repository.ts` (updated)
    - `src/api-gateway/modules/auth/auth.module.ts` (updated)
    - `src/api-gateway/modules/search/search.client.module.ts` (updated)

### Cải tiến

- **Validation logic cho Booking State (2025-11-25)**
  - Thêm validation `fareClassCode` phải match với `cabinType`:
    - Economy: `fareClassCode` phải bắt đầu bằng 'Y' (ví dụ: 'YS', 'YF', 'YSM')
    - Business: `fareClassCode` phải bắt đầu bằng 'J' (ví dụ: 'JS', 'JF', 'JFLX')
  - Exception mới: `InvalidFareClassException` khi validation fail
  - Đảm bảo data integrity trước khi lưu vào Redis

- **Cải thiện Docker initialization flow (2025-11-25)**
  - Tách `wait-for-sqlserver.ts` và `wait-for-database.ts` để tránh race condition
  - Flow mới: `wait-for-sqlserver` → `init-db` → `wait-for-db` → `seed-db` → `start:all`
  - Thêm verification step sau migrations để đảm bảo database sẵn sàng
  - Tăng delay trước khi start services (10 giây) để đảm bảo database hoàn toàn sẵn sàng
  - Fix lỗi "Login failed" do database chưa tồn tại khi services kết nối

- **Code organization improvements (2025-11-25)**
  - Tách interfaces ra file riêng (`docker/start-all.types.ts`)
  - Tuân thủ separation of concerns: types tách khỏi logic code

### Tính năng mới

- **Email thông báo tự động (2025-11-23)**
  - Gửi email xác nhận thanh toán thành công/thất bại tự động
  - Gửi email xác nhận đặt chỗ sau khi tạo booking
  - Email được gửi ngầm, không làm chậm quá trình xử lý

- **Mã OTP cho xác thực (2025-11-23)**
  - Gửi mã OTP qua email cho thanh toán (hết hạn sau 15 phút)
  - Gửi mã OTP qua email cho đặt lại mật khẩu (hết hạn sau 10 phút)
  - Mã OTP chỉ dùng được một lần, tự động xóa sau khi xác thực thành công
  - Bảo mật: Không tiết lộ email có tồn tại hay không khi quên mật khẩu
  - **API mới**:
    - `POST /api/v1/auth/otp/payment/send` - Gửi OTP thanh toán
    - `POST /api/v1/auth/otp/payment/verify` - Xác thực OTP thanh toán
    - `POST /api/v1/auth/otp/password-reset/send` - Gửi OTP đặt lại mật khẩu
    - `POST /api/v1/auth/otp/password-reset/verify` - Xác thực OTP và đặt lại mật khẩu

- **Tải ảnh tự động cho deals (2025-11-22)**
  - Script tự động tải ảnh phong cảnh cho các deals
  - Chạy lệnh: `npm run download:deals-images`

### Thay đổi

- **Tìm kiếm chuyến bay đơn giản hơn (2025-11-21)**
  - Không cần truyền `tripType` nữa, hệ thống tự động nhận biết:
    - Có ngày về → Tự động là khứ hồi
    - Không có ngày về → Tự động là một chiều

- **Chọn ghế ngồi (2025-01-XX)**
  - Có thể chọn ghế khi đặt chỗ
  - Xem bản đồ ghế trước khi đặt vé
  - Ghế được giữ tự động khi tạo reservation

- **Chuẩn hóa cấu hình máy bay 2025-11-21)**
  - Tất cả máy bay đều có 180 ghế
  - Dễ dàng quản lý và tính toán

### Sửa lỗi

- **Xử lý lỗi tốt hơn (2025-11-20)**
  - Phân biệt rõ lỗi kỹ thuật (503) và lỗi dữ liệu (400/404)
  - Thông báo lỗi rõ ràng hơn cho người dùng

- **Sửa tên loại vé (2025-11-20)**
  - Hiển thị đúng tên loại vé: Standard thay vì Smart
  - Economy có 4 loại: Saver Max, Standard, Smart, Flex
  - Business có 3 loại: Standard, Smart, Flex

---

## [Previous Versions]

*Các version trước không có changelog chi tiết*
