# 🛠️ Tools & Utilities

Thư mục này chứa các công cụ và scripts hỗ trợ cho dự án.

## 📋 Danh sách Tools

### 🧪 Testing & Debugging

- **test-db-connection.ts** - Script test kết nối database (TypeScript)
  ```bash
  npm run test:db
  # hoặc
  ts-node -r tsconfig-paths/register tools/test-db-connection.ts
  ```
  - Type-safe với proper TypeScript typing
  - Sử dụng shared interface `SqlConfig` từ `src/shared/types/database/`

- **test-otp-email.ts** - Script test gửi OTP email (TypeScript)
  ```bash
  npm run test:email
  # hoặc
  ts-node -r tsconfig-paths/register tools/test-otp-email.ts
  ```
  - Test email service health check
  - Test gửi OTP email với authentication token
  - Type-safe HTTP requests và responses

- **test-db-connection.sh** - Script test kết nối database từ bash (Linux/Mac/WSL)
  ```bash
  bash tools/test-db-connection.sh
  ```

### 📡 API Testing

- **Flight-Booking-API.postman_collection.json** - Postman collection để test tất cả API endpoints
  - Import vào Postman để test API
  - Bao gồm tất cả endpoints: Auth, Search, Booking, Reservation, Routes, Services
  - Có sẵn variables và pre-request scripts

### 🔧 System Utilities

- **open-firewall-port.ps1** - PowerShell script để mở firewall port cho SQL Server
  ```powershell
  .\tools\open-firewall-port.ps1
  ```

## 📝 Lưu ý

- Tất cả scripts cần file `.env` trong thư mục root để hoạt động
- Đảm bảo đã cài đặt dependencies trước khi chạy Node.js scripts

