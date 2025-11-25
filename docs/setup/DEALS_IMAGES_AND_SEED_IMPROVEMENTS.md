# Deals Images Download & Database Seeding Improvements

## Overview

Các cải tiến quan trọng cho việc quản lý deals images và database seeding để đảm bảo data consistency và automation.

## Deals Images Download Script

### Script Location

`scripts/download-deals-images.ts`

### Features

1. **Auto-cleanup Old Images**: Tự động xóa tất cả ảnh cũ trong `public/images/routes` trước khi download ảnh mới
2. **Top 8 Deals Only**: Chỉ download ảnh cho top 8 deals từ API `/api/v1/services/deals`
3. **API Gateway Health Check**: Đợi API Gateway sẵn sàng trước khi fetch deals
4. **Retry Logic**: Exponential backoff cho health check và API calls
5. **Error Handling**: Comprehensive error handling với logging

### Usage

```bash
npm run download:deals-images
```

### Script Flow

1. **Delete Old Images**: Xóa tất cả `.jpg`, `.jpeg`, `.png` files trong `public/images/routes`
2. **Wait for API Gateway**: Poll `/api/v1/health` endpoint với retry logic
3. **Fetch Top 8 Deals**: Call `GET /api/v1/services/deals` và slice 8 items đầu tiên
4. **Download Images**: Download ảnh từ Lorem Picsum cho mỗi deal
5. **Save Images**: Lưu ảnh với format `{route_id}.jpg`

### Configuration

```typescript
const DEALS_LIMIT = 8; // Top 8 deals
const IMAGE_DIR = path.join(process.cwd(), 'public/images/routes');
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
```

### Health Check

```typescript
async function waitForApiGateway(maxRetries = 30, initialDelay = 2000): Promise<boolean> {
  const healthUrl = `${API_BASE_URL}/api/v1/health`;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(healthUrl, { timeout: 5000 });
      if (response.status === 200) {
        return true; // API Gateway is ready
      }
    } catch (error) {
      // Continue retrying
    }
    
    if (attempt < maxRetries) {
      const delay = initialDelay * Math.pow(1.5, attempt - 1); // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return false; // API Gateway not ready after max retries
}
```

## Database Seeding Improvements

### Conditional Seeding Script

**Location**: `docker/seed-if-empty.ts`

### Features

1. **Check Existing Data**: Kiểm tra database đã có data chưa trước khi seed
2. **Raw SQL Queries**: Sử dụng raw SQL để tránh TypeORM entity metadata issues
3. **Graceful Exit**: Nếu đã có data, log message và exit gracefully
4. **Prevent Duplicate Seeding**: Tránh seed lại data đã tồn tại

### Usage

```bash
npm run seed:if-empty
```

### Check Logic

```typescript
async function hasExistingSeedData(dataSource: DataSource): Promise<boolean> {
  const queryRunner = dataSource.createQueryRunner();
  try {
    await queryRunner.connect();
    
    // Check key tables using raw SQL
    const userCount = await queryRunner.query('SELECT COUNT(*) as count FROM dbo.Users');
    const routeCount = await queryRunner.query('SELECT COUNT(*) as count FROM dbo.Routes');
    const scheduleCount = await queryRunner.query('SELECT COUNT(*) as count FROM dbo.FlightSchedules');
    const instanceCount = await queryRunner.query('SELECT COUNT(*) as count FROM dbo.FlightInstances');

    const hasData = 
      (userCount[0]?.count ?? 0) > 0 ||
      (routeCount[0]?.count ?? 0) > 0 ||
      (scheduleCount[0]?.count ?? 0) > 0 ||
      (instanceCount[0]?.count ?? 0) > 0;

    return hasData;
  } finally {
    await queryRunner.release();
  }
}
```

### Docker Integration

**File**: `docker/entrypoint-with-download.ts`

**Flow**:
1. Start all services (`npm run start:all`)
2. Wait for API Gateway to be ready
3. Run `download:deals-images` script
4. Handle graceful shutdown

**Usage in Docker**:
```yaml
# docker-compose.yml
command: sh -c "npm run wait-for-sqlserver && npm run wait-for-db && npm run start:all:with-download"
```

## Docker Entrypoint Improvements

### Entrypoint with Download

**Location**: `docker/entrypoint-with-download.ts`

### Features

1. **Service Orchestration**: Start all backend services
2. **Health Check**: Wait for API Gateway before downloading images
3. **Image Download**: Automatically download deals images after services are ready
4. **Graceful Shutdown**: Handle SIGTERM/SIGINT signals

### Script Flow

```typescript
async function main() {
  // 1. Start all services in background
  const servicesProcess = spawn('npm', ['run', 'start:all'], {
    stdio: 'inherit',
    shell: true
  });

  // 2. Wait for API Gateway
  const isReady = await waitForApiGateway();
  if (!isReady) {
    console.error('API Gateway not ready after max retries');
    process.exit(1);
  }

  // 3. Download deals images
  await runDownloadDealsImages();

  // 4. Handle graceful shutdown
  process.on('SIGTERM', () => {
    servicesProcess.kill('SIGTERM');
    process.exit(0);
  });
}
```

## Best Practices

1. **Always Clean Old Images**: Xóa ảnh cũ trước khi download mới để tránh orphaned files
2. **Check Data Before Seeding**: Luôn kiểm tra data tồn tại trước khi seed
3. **Health Checks**: Đợi services sẵn sàng trước khi thực hiện operations phụ thuộc
4. **Error Handling**: Comprehensive error handling với logging và retry logic
5. **Raw SQL for Checks**: Sử dụng raw SQL cho data existence checks để tránh TypeORM issues

## Related Files

- `scripts/download-deals-images.ts` - Main download script
- `docker/seed-if-empty.ts` - Conditional seeding script
- `docker/entrypoint-with-download.ts` - Docker entrypoint with download
- `src/scripts/seed-full-database.ts` - Full database seeding script

## Changelog

- **2025-11-25**: Added auto-cleanup old images before download
- **2025-11-25**: Limited to top 8 deals only
- **2025-11-25**: Added API Gateway health check with retry logic
- **2025-11-25**: Added conditional seeding script to prevent duplicate data
- **2025-11-25**: Added Docker entrypoint with automatic image download

