-- =========================================================
-- QUICK QUERY: LẤY USER ID HỢP LỆ (UUID v7) ĐỂ TEST BOOKING API
-- =========================================================
-- Query đơn giản để lấy user_id hợp lệ (UUID v7 format)
-- Copy user_id từ kết quả để dùng trong Postman/API test
-- =========================================================

USE flight_booking_db;
GO

-- Lấy 5 user IDs hợp lệ (UUID v7) mới nhất
SELECT TOP 5
    CAST(user_id AS VARCHAR(36)) AS 'User ID (Copy để test)',
    fullname AS 'Tên',
    email AS 'Email',
    phone AS 'Số điện thoại',
    CASE 
        WHEN is_active = 1 THEN 'Active'
        ELSE 'Inactive'
    END AS 'Trạng thái'
FROM Users
WHERE SUBSTRING(CAST(user_id AS VARCHAR(36)), 15, 1) = '7'  -- UUID v7 có số 7 ở vị trí version
ORDER BY created_at DESC;
GO

-- Hoặc chỉ lấy user_id (để copy nhanh)
SELECT TOP 1 CAST(user_id AS VARCHAR(36)) AS user_id
FROM Users
WHERE SUBSTRING(CAST(user_id AS VARCHAR(36)), 15, 1) = '7'
ORDER BY created_at DESC;
GO

-- Lưu ý:
-- - UUID v7 format: xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx
-- - Phải có số '7' ở vị trí version (sau dấu gạch ngang thứ 2)
-- - User IDs được tạo từ seed script (npm run seed:full) sẽ là UUID v7
-- - User IDs được tạo từ SQL DEFAULT NEWSEQUENTIALID() sẽ KHÔNG phải UUID v7

