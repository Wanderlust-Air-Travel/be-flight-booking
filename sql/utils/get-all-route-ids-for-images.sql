-- =========================================================
-- LẤY DANH SÁCH ROUTE_ID ĐỂ ĐẶT TÊN ẢNH
-- =========================================================
-- Script này giúp bạn lấy tất cả route_id từ database
-- để đặt tên các file ảnh phong cảnh theo format: {route_id}.jpg
-- =========================================================

USE flight_booking_db;
GO

-- Lấy tất cả route_id (UUID v7) kèm thông tin route để dễ nhận biết
SELECT 
    r.route_id,
    r.route_id AS image_filename,  -- Format: {route_id}.jpg
    CONCAT('/images/routes/', r.route_id, '.jpg') AS image_url,  -- Đường dẫn đầy đủ
    o.iata_code AS origin_code,
    o.city AS origin_city,
    d.iata_code AS destination_code,
    d.city AS destination_city,
    CONCAT(o.city, ' (', o.iata_code, ') -> ', d.city, ' (', d.iata_code, ')') AS route_description,
    r.image_url AS current_image_url,  -- Kiểm tra xem đã có image_url chưa
    r.is_domestic
FROM Routes r
INNER JOIN Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN Airports d ON r.destination_airport_id = d.airport_id
WHERE r.is_domestic = 1  -- Chỉ lấy routes nội địa (deals API chỉ hiển thị domestic routes)
ORDER BY o.iata_code, d.iata_code;
GO

-- =========================================================
-- UPDATE IMAGE_URL CHO TẤT CẢ ROUTES
-- =========================================================
-- Chạy script này SAU KHI đã đặt tất cả ảnh vào public/images/routes/
-- Script này sẽ update image_url trong database theo format chuẩn
-- =========================================================

/*
UPDATE Routes
SET image_url = CONCAT('/images/routes/', CAST(route_id AS VARCHAR(36)), '.jpg')
WHERE is_domestic = 1
  AND image_url IS NULL;  -- Chỉ update những route chưa có image_url
GO
*/

-- =========================================================
-- KIỂM TRA ROUTES CHƯA CÓ IMAGE_URL
-- =========================================================
/*
SELECT 
    r.route_id,
    o.iata_code AS origin,
    d.iata_code AS destination,
    r.image_url
FROM Routes r
INNER JOIN Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN Airports d ON r.destination_airport_id = d.airport_id
WHERE r.is_domestic = 1
  AND r.image_url IS NULL;
GO
*/

