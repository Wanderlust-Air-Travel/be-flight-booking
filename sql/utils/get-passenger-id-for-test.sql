-- =========================================================
-- QUICK QUERY: LẤY PASSENGER ID ĐỂ TEST BOOKING API
-- =========================================================
-- Query đơn giản để lấy passenger_id hợp lệ
-- Copy passenger_id từ kết quả để dùng trong Postman/API test
-- =========================================================

USE flight_booking_db;
GO

-- Lấy 5 passenger IDs mới nhất (đủ thông tin để test)
SELECT TOP 5
    passenger_id AS 'Passenger ID (Copy để test)',
    fullname AS 'Tên',
    dob AS 'Ngày sinh',
    gender AS 'Giới tính',
    document_number AS 'Số CMND/Passport',
    CASE 
        WHEN user_id IS NULL THEN 'Guest'
        ELSE 'User: ' + CAST(user_id AS VARCHAR(36))
    END AS 'Loại'
FROM Passengers
ORDER BY created_at DESC;
GO

-- Hoặc chỉ lấy passenger_id (để copy nhanh)
SELECT TOP 1 passenger_id
FROM Passengers
ORDER BY created_at DESC;
GO

