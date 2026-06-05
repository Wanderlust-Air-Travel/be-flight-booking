# Flight Booking Backend

Backend cho hệ thống đặt vé máy bay nội địa Việt Nam, xây dựng bằng NestJS theo kiến trúc API Gateway + TCP microservices.

## Tổng quan

Backend này chịu trách nhiệm cho:
- tìm kiếm chuyến bay nội địa
- reservation / seat locking
- booking và ticketing
- payment flow
- email notifications
- admin APIs cho lịch bay, giá vé, hành lý, cabin services
- realtime updates qua WebSocket

## Tech Stack

- **Framework**: NestJS 11
- **Language**: TypeScript
- **Database**: Microsoft SQL Server
- **ORM**: TypeORM
- **Cache / Locking**: Redis
- **Message Broker**: RabbitMQ
- **Realtime**: Socket.IO + Redis Pub/Sub
- **Auth**: JWT + Passport
- **API Docs**: Swagger

## Project Structure

```text
be-flight-booking/
├── src-nestjs/
│   ├── api-gateway/          # HTTP API + WebSocket gateway
│   ├── microservices/        # Search, routes, booking, reservation, payment, email...
│   ├── shared/               # Entities, DTOs, config, guards, services
│   └── scripts/              # Seed và utility scripts
├── apps/                     # Experimental Go services
├── infrastructure/           # Infra, deployment, monitoring
├── docker/                   # Docker helper scripts
├── docs/                     # Project docs
└── package.json
```

## Requirements

- Node.js 18+
- npm 9+
- Docker Desktop
- SQL Server nếu chạy local không dùng Docker

## Quick Start

### 1. Cài dependencies

```bash
cd be-flight-booking
npm install
```

### 2. Chạy infrastructure

```bash
npm run docker:infra:up
```

Infrastructure mặc định gồm:
- SQL Server
- Redis
- RabbitMQ

### 3. Chạy backend

Có 2 cách phổ biến.

#### Cách A — chạy backend bằng Docker

```bash
npm run docker:dev:up
```

#### Cách B — chạy backend local bằng ts-node

```bash
npm run start:all
```

## Services & Ports

| Service | Port |
|---|---:|
| API Gateway | 3000 |
| Search microservice | 4001 |
| Services microservice | 4002 |
| Routes microservice | 4003 |
| Booking microservice | 4004 |
| Reservation microservice | 4005 |
| Payment microservice | 4006 |
| Email microservice | 4007 |
| SQL Server | 1433 / 1434 tùy môi trường |
| Redis | 6379 |
| RabbitMQ | 5672 |
| RabbitMQ UI | 15672 |

## Useful Scripts

### App

```bash
npm run start:dev
npm run start:all
npm run start:search:dev
npm run start:booking:dev
npm run start:reservation:dev
npm run start:payment:dev
npm run start:email:dev
```

### Database / Seed

```bash
npm run migration:run
npm run migration:show
npm run seed:full
npm run seed:internal-schedule
npm run sync:flight-data
npm run data:sync
```

### Quality

```bash
npm run lint
npm run lint:fix
npm run test
npm run test:cov
```

### Docker

```bash
npm run docker:infra:up
npm run docker:infra:down
npm run docker:infra:logs
npm run docker:dev:build
npm run docker:dev:up
npm run docker:dev:logs
```

## API & Realtime

- **Swagger UI**: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
- **WebSocket namespace**: `ws://localhost:3000/realtime`

## Environment Variables

Xem các file mẫu:
- `.env.example`
- `.env.development.example`

Các biến quan trọng:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `REDIS_HOST`, `REDIS_PORT`
- `RABBITMQ_URL`
- `PORT`

## Business Notes

- hệ thống chỉ hỗ trợ **bay nội địa Việt Nam**
- frontend chỉ gọi HTTP vào **API Gateway**
- microservices giao tiếp qua **TCP** và một phần qua **RabbitMQ**
- reservation / seat locking dùng **Redis TTL**
- payment và booking cần **idempotency**
- IDs dùng **UUID v7** từ application code

## Documentation

Xem chỉ mục docs tại [`docs/README.md`](./docs/README.md).

Các tài liệu quan trọng:
- [`docs/STRUCTURE.md`](./docs/STRUCTURE.md)
- [`docs/ROLES_AND_PERMISSIONS.md`](./docs/ROLES_AND_PERMISSIONS.md)
- [`docs/database/SEED-README.md`](./docs/database/SEED-README.md)
- [`docs/database/DOCKER_INITIALIZATION.md`](./docs/database/DOCKER_INITIALIZATION.md)
- [`src-nestjs/api-gateway/modules/realtime/README.md`](./src-nestjs/api-gateway/modules/realtime/README.md)

## Notes

- Thư mục `apps/` là nhánh thử nghiệm Go, không phải luồng chạy chính hiện tại.
- Tài liệu cũ có thể còn nhắc `src/`; cấu trúc đúng hiện tại là `src-nestjs/`.
