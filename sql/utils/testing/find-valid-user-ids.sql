-- =========================================================
-- TÌM USER IDs HỢP LỆ (UUID v7)
-- =========================================================
-- File này chứa các query để tìm user IDs hợp lệ (UUID v7 format)
-- UUID v7 format: xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx
-- Version 7 được chỉ định bởi chữ số '7' ở vị trí version (sau dấu gạch ngang thứ 2)
-- =========================================================

USE flight_booking_db;
GO

-- =========================================================
-- 1. LẤY TẤT CẢ USER IDs HỢP LỆ (UUID v7)
-- =========================================================
-- Chỉ lấy user_id có format UUID v7 (có số '7' ở vị trí version)
SELECT 
    user_id,
    fullname,
    email,
    phone,
    is_active,
    created_at
FROM Users
WHERE CAST(user_id AS VARCHAR(36)) LIKE '%-7%'  -- UUID v7 có số 7 ở vị trí version
    AND LEN(CAST(user_id AS VARCHAR(36))) = 36   -- Đảm bảo đúng format UUID
ORDER BY created_at DESC;
GO

-- =========================================================
-- 2. LẤY USER IDs HỢP LỆ (Kiểm tra chính xác hơn)
-- =========================================================
-- Kiểm tra chính xác format UUID v7: xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx
-- Vị trí version là ký tự thứ 15 (sau "xxxxxxxx-xxxx-")
SELECT 
    user_id,
    fullname,
    email,
    phone,
    is_active,
    created_at,
    CAST(user_id AS VARCHAR(36)) AS user_id_string
FROM Users
WHERE SUBSTRING(CAST(user_id AS VARCHAR(36)), 15, 1) = '7'  -- Vị trí version phải là '7'
ORDER BY created_at DESC;
GO

-- =========================================================
-- 3. LẤY 10 USER IDs HỢP LỆ MỚI NHẤT (Cho testing nhanh)
-- =========================================================
SELECT TOP 10
    user_id,
    fullname,
    email,
    phone,
    is_active
FROM Users
WHERE SUBSTRING(CAST(user_id AS VARCHAR(36)), 15, 1) = '7'
ORDER BY created_at DESC;
GO

-- =========================================================
-- 4. LẤY USER ID ĐẦU TIÊN HỢP LỆ (Cho quick test)
-- =========================================================
SELECT TOP 1
    user_id,
    fullname,
    email
FROM Users
WHERE SUBSTRING(CAST(user_id AS VARCHAR(36)), 15, 1) = '7'
ORDER BY created_at DESC;
GO

-- =========================================================
-- 5. LẤY USER IDs KHÔNG HỢP LỆ (Để kiểm tra)
-- =========================================================
-- Lấy các user_id không phải UUID v7 (để xem có bao nhiêu)
SELECT 
    user_id,
    fullname,
    email,
    SUBSTRING(CAST(user_id AS VARCHAR(36)), 15, 1) AS version_char,
    created_at
FROM Users
WHERE SUBSTRING(CAST(user_id AS VARCHAR(36)), 15, 1) != '7'
ORDER BY created_at DESC;
GO

-- =========================================================
-- 6. LẤY USER IDs VỚI THÔNG TIN PASSENGERS
-- =========================================================
-- Lấy user_id hợp lệ cùng với số lượng passengers
SELECT 
    u.user_id,
    u.fullname,
    u.email,
    COUNT(p.passenger_id) AS total_passengers
FROM Users u
LEFT JOIN Passengers p ON u.user_id = p.user_id
WHERE SUBSTRING(CAST(u.user_id AS VARCHAR(36)), 15, 1) = '7'
GROUP BY u.user_id, u.fullname, u.email
ORDER BY total_passengers DESC, u.created_at DESC;
GO

-- =========================================================
-- 7. LẤY USER ID HỢP LỆ THEO EMAIL
-- =========================================================
-- Thay 'user@example.com' bằng email thực tế
DECLARE @UserEmail VARCHAR(100) = 'user@example.com';

SELECT 
    user_id,
    fullname,
    email,
    phone
FROM Users
WHERE email = @UserEmail
    AND SUBSTRING(CAST(user_id AS VARCHAR(36)), 15, 1) = '7';
GO

-- =========================================================
-- 8. LẤY CHỈ USER ID (Để copy/paste nhanh)
-- =========================================================
SELECT TOP 1 CAST(user_id AS VARCHAR(36)) AS user_id
FROM Users
WHERE SUBSTRING(CAST(user_id AS VARCHAR(36)), 15, 1) = '7'
ORDER BY created_at DESC;
GO

-- =========================================================
-- 9. SO SÁNH USER IDs HỢP LỆ VS KHÔNG HỢP LỆ
-- =========================================================
SELECT 
    CASE 
        WHEN SUBSTRING(CAST(user_id AS VARCHAR(36)), 15, 1) = '7' THEN 'UUID v7 (Valid)'
        ELSE 'Not UUID v7 (Invalid)'
    END AS uuid_type,
    COUNT(*) AS count
FROM Users
GROUP BY CASE 
    WHEN SUBSTRING(CAST(user_id AS VARCHAR(36)), 15, 1) = '7' THEN 'UUID v7 (Valid)'
    ELSE 'Not UUID v7 (Invalid)'
END;
GO

