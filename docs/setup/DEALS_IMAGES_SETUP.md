# Hướng Dẫn Đặt Ảnh Phong Cảnh Cho Deals API

## Tổng Quan

API `/api/v1/services/deals` hiển thị các deal chuyến bay với ảnh phong cảnh. Mỗi route (tuyến bay) cần có một ảnh phong cảnh được đặt trong thư mục `public/images/routes/` với tên file theo format: `{route_id}.jpg`

## Cấu Trúc Thư Mục

```
be-flight-booking/
└── public/
    └── images/
        └── routes/
            ├── {route_id_1}.jpg
            ├── {route_id_2}.jpg
            └── ...
```

## Format Tên File

- **Format**: `{route_id}.jpg`
- **route_id**: UUID v7 (36 ký tự), ví dụ: `019a8f4a-bb0e-7402-a0c4-27647b89dc71`
- **Ví dụ**: `019a8f4a-bb0e-7402-a0c4-27647b89dc71.jpg`

## Các Bước Thực Hiện

### Bước 1: Lấy Danh Sách Route IDs

Chạy SQL script để lấy danh sách tất cả route_id:

```sql
-- File: sql/utils/get-all-route-ids-for-images.sql
USE flight_booking_db;
GO

SELECT 
    r.route_id,
    CONCAT('/images/routes/', r.route_id, '.jpg') AS image_url,
    o.iata_code AS origin_code,
    d.iata_code AS destination_code,
    CONCAT(o.city, ' (', o.iata_code, ') -> ', d.city, ' (', d.iata_code, ')') AS route_description
FROM Routes r
INNER JOIN Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN Airports d ON r.destination_airport_id = d.airport_id
WHERE r.is_domestic = 1
ORDER BY o.iata_code, d.iata_code;
```

### Bước 2: Đặt Ảnh Vào Thư Mục

1. Chuẩn bị các file ảnh phong cảnh (format JPG, khuyến nghị kích thước 1920x1080 hoặc tương tự)
2. Đặt tên file theo format: `{route_id}.jpg`
3. Copy tất cả ảnh vào thư mục: `public/images/routes/`

**Ví dụ:**
- Route ID: `019a8f4a-bb0e-7402-a0c4-27647b89dc71`
- Tên file: `019a8f4a-bb0e-7402-a0c4-27647b89dc71.jpg`
- Đường dẫn đầy đủ: `public/images/routes/019a8f4a-bb0e-7402-a0c4-27647b89dc71.jpg`

### Bước 3: Update Database (Tùy Chọn)

Nếu bạn muốn lưu `image_url` vào database (không bắt buộc vì service đã có fallback), chạy script:

```sql
UPDATE Routes
SET image_url = CONCAT('/images/routes/', CAST(route_id AS VARCHAR(36)), '.jpg')
WHERE is_domestic = 1
  AND image_url IS NULL;
```

**Lưu ý**: Service đã có logic fallback tự động generate `image_url` từ `route_id`, nên bước này là tùy chọn.

## Cách API Sử Dụng Ảnh

### Logic Trong Service

File: `src/microservices/services/services.service.ts`

```typescript
// Lấy image_url từ database, nếu không có thì generate fallback
const image = route.image_url || this.generateImageUrl(route.route_id);

private generateImageUrl(routeId: string): string {
    return `/images/routes/${routeId}.jpg`;
}
```

### URL Truy Cập Ảnh

Sau khi đặt ảnh vào `public/images/routes/`, ảnh sẽ được serve tự động qua:

```
GET {{base_url}}/images/routes/{route_id}.jpg
```

**Ví dụ:**
```
GET http://localhost:3000/images/routes/019a8f4a-bb0e-7402-a0c4-27647b89dc71.jpg
```

### Response Từ Deals API

API `/api/v1/services/deals` sẽ trả về:

```json
{
  "deals": [
    {
      "image": "/images/routes/019a8f4a-bb0e-7402-a0c4-27647b89dc71.jpg",
      "title": "Tp. Hồ Chí Minh (SGN) đến Hà Nội (HAN)",
      "link": "/service/019a8f4a-bb0e-7402-a0c4-27647b89dc71",
      "startDate": "02/03/2026",
      "endDate": "",
      "tripType": "one_way",
      "service": "Dịch vụ bay thẳng",
      "price": "962,000 VND"
    }
  ]
}
```

## Kiểm Tra

### 1. Kiểm Tra File Ảnh Có Tồn Tại

```bash
# Windows PowerShell
Get-ChildItem -Path "public\images\routes" -Filter "*.jpg"

# Linux/Mac
ls -la public/images/routes/*.jpg
```

### 2. Kiểm Tra Routes Chưa Có Ảnh

```sql
SELECT 
    r.route_id,
    o.iata_code AS origin,
    d.iata_code AS destination,
    CASE 
        WHEN r.image_url IS NOT NULL THEN 'Has URL in DB'
        ELSE 'Missing URL (will use fallback)'
    END AS status
FROM Routes r
INNER JOIN Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN Airports d ON r.destination_airport_id = d.airport_id
WHERE r.is_domestic = 1
ORDER BY o.iata_code, d.iata_code;
```

### 3. Test API

```bash
# Test Deals API
curl http://localhost:3000/api/v1/services/deals

# Test truy cập ảnh trực tiếp
curl http://localhost:3000/images/routes/{route_id}.jpg
```

## Lưu Ý

1. **Kích Thước Ảnh**: Khuyến nghị 1920x1080 (16:9) hoặc tỷ lệ tương tự để hiển thị đẹp trên web
2. **Format**: Chỉ hỗ trợ `.jpg` (JPEG)
3. **Tên File**: Phải chính xác theo `route_id` (UUID v7), phân biệt hoa thường
4. **Static Files**: Ảnh được serve tự động qua NestJS static assets, không cần cấu hình thêm
5. **Fallback**: Nếu không có ảnh, API vẫn hoạt động nhưng frontend có thể hiển thị placeholder

## Troubleshooting

### Ảnh Không Hiển Thị

1. Kiểm tra tên file có đúng format `{route_id}.jpg` không
2. Kiểm tra file có trong thư mục `public/images/routes/` không
3. Kiểm tra server đã restart sau khi thêm ảnh chưa (NestJS cache static files)
4. Kiểm tra URL trong response API có đúng format không

### Ảnh Bị 404

- Đảm bảo tên file khớp chính xác với `route_id` (bao gồm cả dấu gạch ngang)
- Kiểm tra file extension là `.jpg` (không phải `.jpeg` hoặc `.JPG`)
- Restart server để NestJS reload static files

## Script Helper

Xem thêm script TypeScript helper tại: `scripts/verify-deals-images.ts` (nếu có)

