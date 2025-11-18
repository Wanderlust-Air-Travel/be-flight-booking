-- Script để lấy route_id hợp lệ để test upload ảnh
-- Route ID phải là UUID v7 format (36 ký tự)

USE flight_booking_db; -- Thay đổi database name nếu cần
GO

-- Option 1: Lấy tất cả route_id (domestic routes)
SELECT 
    route_id,
    origin_airport_id,
    destination_airport_id,
    image_url,
    service_link,
    is_domestic
FROM dbo.Routes
WHERE is_domestic = 1
ORDER BY created_at DESC;
GO

-- Option 2: Lấy route_id đầu tiên (để test nhanh)
SELECT TOP 1
    route_id AS 'Route ID để test',
    image_url AS 'Image URL hiện tại',
    service_link AS 'Service Link hiện tại'
FROM dbo.Routes
WHERE is_domestic = 1
ORDER BY created_at DESC;
GO

-- Option 3: Lấy route_id chưa có image_url (để test upload)
SELECT TOP 5
    route_id AS 'Route ID (chưa có image)',
    image_url AS 'Image URL hiện tại',
    service_link AS 'Service Link hiện tại'
FROM dbo.Routes
WHERE is_domestic = 1
    AND (image_url IS NULL OR image_url = '')
ORDER BY created_at DESC;
GO

-- Option 4: Lấy route_id đã có image_url (để test update)
SELECT TOP 5
    route_id AS 'Route ID (đã có image)',
    image_url AS 'Image URL hiện tại',
    service_link AS 'Service Link hiện tại'
FROM dbo.Routes
WHERE is_domestic = 1
    AND image_url IS NOT NULL
    AND image_url != ''
ORDER BY created_at DESC;
GO

-- Option 5: Lấy route_id với thông tin chi tiết (origin -> destination)
SELECT TOP 10
    r.route_id AS 'Route ID',
    o.iata_code + ' -> ' + d.iata_code AS 'Route',
    o.city + ' (' + o.iata_code + ') -> ' + d.city + ' (' + d.iata_code + ')' AS 'Route Detail',
    r.image_url AS 'Image URL',
    r.service_link AS 'Service Link',
    CASE 
        WHEN r.image_url IS NULL OR r.image_url = '' THEN 'Chưa có image'
        ELSE 'Đã có image'
    END AS 'Status'
FROM dbo.Routes r
INNER JOIN dbo.Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN dbo.Airports d ON r.destination_airport_id = d.airport_id
WHERE r.is_domestic = 1
ORDER BY r.created_at DESC;
GO

