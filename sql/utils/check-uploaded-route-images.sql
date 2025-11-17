-- Script để kiểm tra ảnh đã được upload và update vào database
-- Dùng để verify sau khi upload ảnh qua API

USE flight_booking_db_v2; -- Thay đổi database name nếu cần
GO

-- Option 1: Kiểm tra route cụ thể (thay route_id bằng route_id bạn vừa upload)
DECLARE @RouteId UNIQUEIDENTIFIER = '019A8F51-24CD-74F0-B5F2-CBC06F21CA97'; -- Thay bằng route_id của bạn

SELECT 
    r.route_id AS 'Route ID',
    o.iata_code + ' -> ' + d.iata_code AS 'Route',
    o.city + ' (' + o.iata_code + ') -> ' + d.city + ' (' + d.iata_code + ')' AS 'Route Detail',
    r.image_url AS 'Image URL',
    r.service_link AS 'Service Link',
    CASE 
        WHEN r.image_url IS NULL OR r.image_url = '' THEN 'Chưa có image'
        WHEN r.image_url LIKE '/images/routes/' + CAST(r.route_id AS NVARCHAR(36)) + '.jpg' THEN 'Đã có image (đúng format)'
        ELSE 'Có image (format khác)'
    END AS 'Image Status',
    r.created_at AS 'Created At'
FROM dbo.Routes r
INNER JOIN dbo.Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN dbo.Airports d ON r.destination_airport_id = d.airport_id
WHERE r.route_id = @RouteId;
GO

-- Option 2: Xem tất cả routes đã có image_url (đã upload ảnh)
SELECT 
    r.route_id AS 'Route ID',
    o.iata_code + ' -> ' + d.iata_code AS 'Route',
    r.image_url AS 'Image URL',
    r.service_link AS 'Service Link',
    r.created_at AS 'Created At'
FROM dbo.Routes r
INNER JOIN dbo.Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN dbo.Airports d ON r.destination_airport_id = d.airport_id
WHERE r.is_domestic = 1
    AND r.image_url IS NOT NULL
    AND r.image_url != ''
ORDER BY r.created_at DESC;
GO

-- Option 3: Xem routes chưa có image_url (chưa upload ảnh)
SELECT 
    r.route_id AS 'Route ID',
    o.iata_code + ' -> ' + d.iata_code AS 'Route',
    o.city + ' (' + o.iata_code + ') -> ' + d.city + ' (' + d.iata_code + ')' AS 'Route Detail',
    r.image_url AS 'Image URL',
    r.service_link AS 'Service Link',
    r.created_at AS 'Created At'
FROM dbo.Routes r
INNER JOIN dbo.Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN dbo.Airports d ON r.destination_airport_id = d.airport_id
WHERE r.is_domestic = 1
    AND (r.image_url IS NULL OR r.image_url = '')
ORDER BY r.created_at DESC;
GO

-- Option 4: Thống kê tổng quan
SELECT 
    COUNT(*) AS 'Total Routes',
    SUM(CASE WHEN r.image_url IS NOT NULL AND r.image_url != '' THEN 1 ELSE 0 END) AS 'Routes with Image',
    SUM(CASE WHEN r.image_url IS NULL OR r.image_url = '' THEN 1 ELSE 0 END) AS 'Routes without Image',
    CAST(
        SUM(CASE WHEN r.image_url IS NOT NULL AND r.image_url != '' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) 
        AS DECIMAL(5, 2)
    ) AS 'Percentage with Image'
FROM dbo.Routes r
WHERE r.is_domestic = 1;
GO

-- Option 5: Kiểm tra format image_url có đúng không (UUID v7 format)
SELECT 
    r.route_id AS 'Route ID',
    o.iata_code + ' -> ' + d.iata_code AS 'Route',
    r.image_url AS 'Image URL',
    LEN(r.image_url) AS 'Image URL Length',
    CASE 
        WHEN r.image_url LIKE '/images/routes/%.jpg' 
            AND LEN(r.image_url) = 55 
            AND SUBSTRING(r.image_url, 16, 36) = CAST(r.route_id AS NVARCHAR(36))
        THEN 'Đúng format'
        ELSE 'Sai format'
    END AS 'Format Status'
FROM dbo.Routes r
INNER JOIN dbo.Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN dbo.Airports d ON r.destination_airport_id = d.airport_id
WHERE r.is_domestic = 1
    AND r.image_url IS NOT NULL
    AND r.image_url != ''
ORDER BY r.created_at DESC;
GO

-- Option 6: Xem routes được update gần đây nhất (có thể là routes vừa upload)
SELECT TOP 10
    r.route_id AS 'Route ID',
    o.iata_code + ' -> ' + d.iata_code AS 'Route',
    r.image_url AS 'Image URL',
    r.service_link AS 'Service Link',
    r.created_at AS 'Created At'
FROM dbo.Routes r
INNER JOIN dbo.Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN dbo.Airports d ON r.destination_airport_id = d.airport_id
WHERE r.is_domestic = 1
    AND r.image_url IS NOT NULL
    AND r.image_url != ''
ORDER BY r.created_at DESC;
GO

