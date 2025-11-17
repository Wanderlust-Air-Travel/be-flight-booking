-- Script đơn giản: Lấy 1 route_id để test upload ảnh
-- Copy route_id từ kết quả và dùng trong Postman/API test

USE flight_booking_db_v2; -- Thay đổi database name nếu cần
GO

-- Lấy route_id đầu tiên (domestic route)
SELECT TOP 1
    route_id
FROM dbo.Routes
WHERE is_domestic = 1
ORDER BY created_at DESC;
GO

