/* =========================================================
   VALIDATION: Kiểm tra format của image_url và service_link
   ========================================================= */

-- Lưu ý: Thay đổi database name nếu cần (flight_booking_db)
USE flight_booking_db;
GO

-- Kiểm tra TẤT CẢ routes (hiển thị cả hợp lệ và không hợp lệ)
-- Format chuẩn: route_id là UUID v7 (36 ký tự)
SELECT TOP 20
    route_id,
    image_url,
    service_link,
    CASE 
        WHEN image_url IS NULL THEN 'NULL'
        WHEN image_url NOT LIKE '/images/routes/%.jpg' THEN 'Invalid image_url format (must be /images/routes/{route_id}.jpg)'
        WHEN LEN(image_url) != 55 THEN 'Invalid image_url length (must be 55: /images/routes/ (15) + UUID v7 (36) + .jpg (4))'
        WHEN SUBSTRING(image_url, 16, 36) != CAST(route_id AS VARCHAR(36)) THEN 'image_url route_id does not match route_id (UUID v7)'
        ELSE 'Valid'
    END AS image_url_status,
    CASE 
        WHEN service_link IS NULL THEN 'NULL'
        WHEN service_link NOT LIKE '/service/%' THEN 'Invalid service_link format (must start with /service/)'
        WHEN LEN(service_link) != 45 THEN 'Invalid service_link length (must be 45: /service/ (9) + UUID v7 (36))'
        WHEN SUBSTRING(service_link, 10, 36) != CAST(route_id AS VARCHAR(36)) THEN 'service_link route_id does not match route_id (UUID v7)'
        ELSE 'Valid'
    END AS service_link_status
FROM dbo.Routes
WHERE is_domestic = 1
ORDER BY created_at DESC;
GO

-- Chỉ hiển thị routes CÓ LỖI (nếu có)
SELECT 
    route_id,
    image_url,
    service_link,
    CASE 
        WHEN image_url IS NOT NULL AND image_url NOT LIKE '/images/routes/%.jpg' THEN 'Invalid image_url format (must be /images/routes/{route_id}.jpg)'
        WHEN image_url IS NOT NULL AND LEN(image_url) != 55 THEN 'Invalid image_url length (must be 55: /images/routes/ (15) + UUID v7 (36) + .jpg (4))'
        WHEN image_url IS NOT NULL AND SUBSTRING(image_url, 16, 36) != CAST(route_id AS VARCHAR(36)) THEN 'image_url route_id does not match route_id (UUID v7)'
        ELSE NULL
    END AS image_url_error,
    CASE 
        WHEN service_link IS NOT NULL AND service_link NOT LIKE '/service/%' THEN 'Invalid service_link format (must start with /service/)'
        WHEN service_link IS NOT NULL AND LEN(service_link) != 45 THEN 'Invalid service_link length (must be 45: /service/ (9) + UUID v7 (36))'
        WHEN service_link IS NOT NULL AND SUBSTRING(service_link, 10, 36) != CAST(route_id AS VARCHAR(36)) THEN 'service_link route_id does not match route_id (UUID v7)'
        ELSE NULL
    END AS service_link_error
FROM dbo.Routes
WHERE is_domestic = 1
    AND (
        (image_url IS NOT NULL AND (
            image_url NOT LIKE '/images/routes/%.jpg'
            OR LEN(image_url) != 55
            OR SUBSTRING(image_url, 16, 36) != CAST(route_id AS VARCHAR(36))
        ))
        OR
        (service_link IS NOT NULL AND (
            service_link NOT LIKE '/service/%'
            OR LEN(service_link) != 45
            OR SUBSTRING(service_link, 10, 36) != CAST(route_id AS VARCHAR(36))
        ))
    );
GO

-- Thống kê routes hợp lệ
SELECT 
    COUNT(*) AS total_routes,
    SUM(CASE WHEN image_url IS NOT NULL AND image_url LIKE '/images/routes/%.jpg' AND LEN(image_url) = 55 THEN 1 ELSE 0 END) AS valid_image_url,
    SUM(CASE WHEN service_link IS NOT NULL AND service_link LIKE '/service/%' AND LEN(service_link) = 45 THEN 1 ELSE 0 END) AS valid_service_link,
    SUM(CASE WHEN image_url IS NOT NULL AND service_link IS NOT NULL THEN 1 ELSE 0 END) AS routes_with_both
FROM dbo.Routes
WHERE is_domestic = 1;
GO

