# Cấu trúc Backend - Flight Booking

## Tổng quan

Backend sử dụng **Microservices Architecture với Shared Database**:
- **API Gateway** (port 3000): REST API entry point - nơi FE gọi API
- **Microservices**: Xử lý business logic phức tạp (search, booking, payment...)
- **Shared Database**: Tất cả services dùng chung 1 SQL Server database
- **Shared Code**: Entities, types, config được share giữa tất cả services

## Cấu trúc thư mục

```
src/
├── shared/                    # Code dùng chung
│   ├── entities/              # Database models (TypeORM)
│   ├── types/                 # TypeScript types/interfaces
│   ├── config/                # Configuration
│   └── constants/             # Constants
│
├── api-gateway/               # REST API (port 3000)
│   ├── modules/               # Feature modules
│   │   ├── auth/              # Authentication (login, register)
│   │   ├── user/              # User management
│   │   └── search/            # Search flights (proxy to microservice)
│   ├── app.module.ts          # Root module
│   └── main.ts                # Entry point
│
├── microservices/             # Microservices (TCP message handlers)
│   └── search/                # Search microservice (port 4001)
│       ├── controllers/       # Message handlers
│       ├── services/          # Business logic
│       ├── dto/               # Request/Response DTOs
│       ├── types/             # Internal types
│       └── main.search.ts     # Entry point
│
└── scripts/                   # Database scripts
    └── seed-domestic.ts       # Seed domestic flights data
```

## Luồng xử lý request từ FE

### Example: Search Flights

```
FE → GET /search/flights?origin=HAN&destination=SGN...
  ↓
API Gateway (port 3000)
  ↓ Validate request
  ↓ Send message to microservice
  ↓
Search Microservice (port 4001)
  ↓ Query database
  ↓ Process business logic
  ↓ Return results
  ↓
API Gateway → Response to FE
```

## API Endpoints cho FE

### Base URL
- **API Gateway**: `http://localhost:3000`
- **Swagger Docs**: `http://localhost:3000/api-docs`

### Authentication
- `POST /auth/register` - Đăng ký
- `POST /auth/login` - Đăng nhập
- `POST /auth/refresh` - Refresh token
- `POST /auth/logout` - Đăng xuất

### Search Flights
- `GET /search/flights` - Tìm kiếm chuyến bay
  - **Query params**:
    - `origin` (required): IATA code (3 chars, e.g., "HAN")
    - `destination` (required): IATA code (3 chars, e.g., "SGN")
    - `departDate` (required): YYYY-MM-DD (e.g., "2025-11-17")
    - `returnDate` (optional): YYYY-MM-DD (required nếu `tripType=round_trip`)
    - `tripType` (required): "one_way" hoặc "round_trip"
    - `adults` (required): Số người lớn (≥1)
    - `minors` (required): Số trẻ em (≥0)
  
  - **Response**:
    ```json
    {
      "tripType": "one_way",
      "outbound": [
        {
          "flightInstanceId": "...",
          "flightNumber": "BB0100",
          "departureLocal": "2025-11-17T08:00:00",
          "arrivalLocal": "2025-11-17T10:10:00",
          "availableSeats": 180,
          "origin": { "iata": "HAN", "name": "...", "city": "..." },
          "destination": { "iata": "SGN", "name": "...", "city": "..." }
        }
      ],
      "inbound": [...], // Chỉ có nếu tripType=round_trip
      "totalPassengers": 1
    }
    ```

### User
- `GET /users` - Lấy thông tin user (cần JWT token)

## Response Format

### Success (200)
```json
{
  "tripType": "...",
  "outbound": [...],
  ...
}
```

### Error (400, 404, 500)
```json
{
  "statusCode": 400,
  "message": ["validation error 1", "validation error 2"],
  "error": "Bad Request"
}
```

## Authentication

### Header
```
Authorization: Bearer <access_token>
```

### Token Flow
1. FE gọi `/auth/login` hoặc `/auth/register`
2. Backend trả về `access_token` và `refresh_token`
3. FE lưu tokens (localStorage/sessionStorage)
4. FE gửi `access_token` trong header cho các request cần auth
5. Khi `access_token` hết hạn, FE gọi `/auth/refresh` với `refresh_token`

## Development Commands

```bash
# Start API Gateway (port 3000)
npm run start:dev

# Start Search Microservice (port 4001) - Cần chạy song song với API Gateway
npm run start:search:dev

# Seed database với dữ liệu nội địa (HAN, SGN, DAD)
npm run seed:domestic
```

## Environment Variables

```env
# Database
DB_TYPE=mssql
DB_HOST=localhost
DB_PORT=1433
DB_USER=...
DB_PASS=...
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

## Lưu ý cho FE

1. **API Gateway là entry point duy nhất**: Tất cả requests từ FE đều gọi đến port 3000
2. **Swagger UI**: Xem chi tiết API tại `http://localhost:3000/api-docs`
3. **Search API**: Cần cả API Gateway và Search Microservice đều chạy
4. **Round trip**: Nếu `tripType=round_trip` thì bắt buộc phải có `returnDate`
5. **Error handling**: Check `statusCode` trong response để handle errors
