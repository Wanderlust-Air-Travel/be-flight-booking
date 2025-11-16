# Flight Booking Backend

Backend cho hệ thống đặt vé máy bay nội địa Việt Nam, sử dụng NestJS với Microservices Architecture.

## 📋 Yêu cầu

- **Node.js**: v18.x hoặc cao hơn
- **npm**: v9.x hoặc cao hơn
- **SQL Server**: 2019 hoặc cao hơn (Local hoặc Azure)
- **Git**: Để clone repository

## 🚀 Cài đặt từ đầu

### Bước 1: Clone Repository

```bash
git clone <repository-url>
cd .\be-flight-booking
```

### Bước 2: Cài đặt Dependencies

```bash
npm install
```

### Bước 3: Setup Environment Variables

Copy file `.env.example` thành `.env`:

```bash
copy env.example .env
# Hoặc trên Linux/Mac:
# cp env.example .env
```

Mở file `.env` và cấu hình:

```env
# Database
DB_TYPE=mssql
DB_HOST=localhost
DB_PORT=1433
DB_USER=sa
DB_PASS=YourPassword123
DB_NAME=flight_booking_db
DB_ENCRYPT=false              # Azure thì true
DB_TRUST_CERT=true            # local dev hay dùng true

# API Gateway
PORT=3000

# Token
JWT_ACCESS_SECRET=c769850ee4f001088ba440c3211390099dbb7f9e2e0593be9233e395dce6e931
JWT_ACCESS_EXPIRES='15m'
JWT_REFRESH_SECRET=1bbf355aefde63bd595ec266351544354991b215124ed1b88ab7c8ef92f876d8
JWT_REFRESH_EXPIRES=7d

# Search Microservice
SEARCH_MS_HOST=127.0.0.1
SEARCH_MS_PORT=4001
```

**Lưu ý:**
- Thay `DB_USER`, `DB_PASS` bằng thông tin SQL Server của bạn
- Thay `DB_HOST` nếu dùng SQL Server trên máy khác hoặc Azure
- `JWT_ACCESS_SECRET` và `JWT_REFRESH_SECRET` nên tạo mới cho production

### Bước 4: Setup Database

1. **Tạo Database trong SQL Server:**

```sql
CREATE DATABASE flight_booking_db;
GO
USE flight_booking_db;
GO
```

2. **Chạy SQL Script để tạo tables:**
   - Xem file `ERD.md` hoặc file SQL schema
   - Copy và chạy toàn bộ SQL script trong SQL Server Management Studio (SSMS)

3. **Cấp quyền cho user:**
   - Đảm bảo user trong `.env` có quyền `SELECT, INSERT, UPDATE, DELETE` trên database

### Bước 5: Seed Database (Optional)

Seed dữ liệu mẫu cho domestic flights:

```bash
npm run seed:domestic
```

Script này sẽ tạo:
- Airports: HAN (Hà Nội), SGN (TP. HCM), DAD (Đà Nẵng)
- Routes giữa các sân bay
- Flight schedules mẫu

### Bước 6: Chạy Backend

**Cách 1: Chạy Development Mode (Recommended)**

Terminal 1 - API Gateway:
```bash
npm run start:dev
```
API Gateway sẽ chạy tại: `http://localhost:3000`

Terminal 2 - Search Microservice:
```bash
npm run start:search:dev
```
Search Microservice sẽ chạy tại port 4001 (TCP)

**Cách 2: Chạy Production Mode**

Build project:
```bash
npm run build
```

Chạy API Gateway:
```bash
npm run start:prod
```

Chạy Search Microservice:
```bash
npm run start:search
```

## 📝 Scripts Available

| Script | Mô tả |
|--------|-------|
| `npm run start:dev` | Chạy API Gateway ở development mode (watch mode) |
| `npm run start:search:dev` | Chạy Search Microservice ở development mode (watch mode) |
| `npm run start:prod` | Chạy API Gateway ở production mode |
| `npm run start:search` | Chạy Search Microservice ở production mode |
| `npm run seed:domestic` | Seed dữ liệu mẫu cho domestic flights |
| `npm run build` | Build project (compile TypeScript) |
| `npm run lint` | Chạy ESLint để check code quality |
| `npm run test` | Chạy unit tests |
| `npm run test:e2e` | Chạy end-to-end tests |

## 🔍 Verify Installation

### 1. Kiểm tra API Gateway

Mở browser: `http://localhost:3000/api-docs`

Bạn sẽ thấy Swagger UI với tất cả APIs. Nếu thấy trang này thì API Gateway đã chạy thành công.

### 2. Test Search API

**Trên Swagger UI:**
1. Tìm API `GET /search/flights`
2. Click "Try it out"
3. Nhập parameters:
   - origin: `HAN`
   - destination: `SGN`
   - departDate: `2025-11-17`
   - tripType: `one_way`
   - adults: `1`
   - minors: `0`
4. Click "Execute"

**Hoặc dùng curl:**
```bash
curl "http://localhost:3000/search/flights?origin=HAN&destination=SGN&departDate=2025-11-17&tripType=one_way&adults=1&minors=0"
```

Nếu trả về danh sách flights thì cả API Gateway và Search Microservice đã hoạt động đúng.

### 3. Test Auth API

**Register:**
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullname": "Nguyen Van A",
    "email": "test@example.com",
    "password": "Test123456",
    "phone": "0901234567"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456"
  }'
```

## 📚 Tài liệu

- **API_DOCS.md**: Chi tiết tất cả APIs cho FE developers
- **STRUCTURE.md**: Cấu trúc project và best practices
- **ERD.md**: Database schema và relationships
- **Swagger UI**: `http://localhost:3000/api-docs` (Interactive API docs)

## 🐛 Troubleshooting

### Lỗi: "Cannot connect to database"

**Nguyên nhân:**
- SQL Server chưa chạy
- Thông tin database trong `.env` sai
- Firewall chặn port 1433
- User không có quyền truy cập database

**Giải pháp:**
1. Kiểm tra SQL Server đang chạy:
   ```bash
   # Windows
   Get-Service MSSQLSERVER
   ```
2. Kiểm tra connection string trong `.env`
3. Test connection bằng SSMS
4. Kiểm tra firewall settings

### Lỗi: "Port 3000 already in use"

**Giải pháp:**
- Tìm và kill process đang dùng port 3000:
  ```bash
  # Windows
  netstat -ano | findstr :3000
  taskkill /PID <PID> /F
  ```
- Hoặc đổi PORT trong `.env`

### Lỗi: "Search microservice connection failed"

**Nguyên nhân:**
- Search Microservice chưa chạy
- Port 4001 bị conflict

**Giải pháp:**
1. Đảm bảo đã chạy: `npm run start:search:dev`
2. Kiểm tra port 4001 không bị conflict
3. Check `SEARCH_MS_HOST` và `SEARCH_MS_PORT` trong `.env`

### Lỗi: "Airport not found" khi search flights

**Nguyên nhân:**
- Database chưa có dữ liệu airports

**Giải pháp:**
- Chạy seed script: `npm run seed:domestic`

## 🏗️ Cấu trúc Project

```
src/
├── shared/              # Code dùng chung (entities, types, config)
├── api-gateway/         # REST API (port 3000)
├── microservices/       # Microservices (TCP message handlers)
└── scripts/             # Database scripts (seed, migration)
```

Xem chi tiết tại: [STRUCTURE.md](./STRUCTURE.md)

## 🔐 Authentication Flow

1. User register/login → Nhận `access_token` và `refresh_token`
2. Gửi `access_token` trong header: `Authorization: Bearer <token>`
3. Token hết hạn → Gọi `/auth/refresh` với `refresh_token`
4. Lấy tokens mới và tiếp tục

Xem chi tiết tại: [API_DOCS.md](./API_DOCS.md)

## 📦 Tech Stack

- **Framework**: NestJS 11.x
- **Database**: Microsoft SQL Server
- **ORM**: TypeORM
- **Authentication**: JWT (Passport)
- **API Documentation**: Swagger/OpenAPI
- **Validation**: class-validator
- **Microservices**: @nestjs/microservices (TCP)

## 📞 Support

Nếu gặp vấn đề, hãy:
1. Kiểm tra logs trong terminal
2. Kiểm tra [Troubleshooting](#-troubleshooting) section
3. Xem Swagger UI: `http://localhost:3000/api-docs`
4. Kiểm tra database connection
