# Backend Docs Index

Chỉ mục tài liệu cho `be-flight-booking`.

## Bắt đầu nhanh

- [`../README.md`](../README.md) — hướng dẫn chạy backend
- Swagger UI: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
- WebSocket namespace: `ws://localhost:3000/realtime`

## Tài liệu nên đọc đầu tiên

- [`STRUCTURE.md`](./STRUCTURE.md) — kiến trúc và các service chính
- [`ROLES_AND_PERMISSIONS.md`](./ROLES_AND_PERMISSIONS.md) — hệ thống roles / RBAC
- [`database/SEED-README.md`](./database/SEED-README.md) — cách seed dữ liệu
- [`database/DOCKER_INITIALIZATION.md`](./database/DOCKER_INITIALIZATION.md) — flow init DB trong Docker
- [`ARCHITECTURE-DATA.md`](./ARCHITECTURE-DATA.md) — data model và business direction

## Database

- [`database/ERD.md`](./database/ERD.md) — ERD / schema overview
- [`database/SEED-README.md`](./database/SEED-README.md) — seed flow
- [`database/DOCKER_INITIALIZATION.md`](./database/DOCKER_INITIALIZATION.md) — init DB trong Docker
- [`database/TRIGGERS.md`](./database/TRIGGERS.md) — database triggers
- [`../docker/MIGRATIONS.md`](../docker/MIGRATIONS.md) — migrations trong Docker

## Realtime / WebSocket

- [`../src-nestjs/api-gateway/modules/realtime/README.md`](../src-nestjs/api-gateway/modules/realtime/README.md) — overview module
- [`../src-nestjs/api-gateway/modules/realtime/SETUP.md`](../src-nestjs/api-gateway/modules/realtime/SETUP.md) — setup guide
- [`../src-nestjs/api-gateway/modules/realtime/INTEGRATION.md`](../src-nestjs/api-gateway/modules/realtime/INTEGRATION.md) — integration guide

## Dành cho dev backend

- [`CHANGELOG.md`](./CHANGELOG.md) — lịch sử thay đổi
- `src-nestjs/shared/constants/messages/README.md` — message conventions
- `src-nestjs/shared/constants/enums/README.md` — shared enums

## Scripts hữu ích

```bash
npm run start:all
npm run migration:run
npm run migration:show
npm run seed:full
npm run seed:internal-schedule
npm run docker:infra:up
npm run docker:dev:up
```

## Ghi chú

- Cấu trúc source hiện tại là `src-nestjs/`, không phải `src/`.
- Một số entry trong `CHANGELOG.md` là historical notes, có thể còn dùng path cũ.
