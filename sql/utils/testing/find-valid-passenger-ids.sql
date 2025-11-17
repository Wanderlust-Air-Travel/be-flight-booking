-- =========================================================
-- TÌM PASSENGER IDs HỢP LỆ
-- =========================================================
-- File này chứa các query để tìm passenger IDs hợp lệ
-- Sử dụng để test booking APIs hoặc lấy passenger data
-- =========================================================

USE flight_booking_db;
GO

-- =========================================================
-- 1. LẤY TẤT CẢ PASSENGER IDs (Đơn giản nhất)
-- =========================================================
SELECT 
    passenger_id,
    fullname,
    dob,
    gender,
    document_number,
    user_id,
    created_at
FROM Passengers
ORDER BY created_at DESC;
GO

-- =========================================================
-- 2. LẤY PASSENGER IDs CỦA MỘT USER CỤ THỂ
-- =========================================================
-- Thay 'YOUR_USER_ID_HERE' bằng user_id thực tế
DECLARE @UserId UNIQUEIDENTIFIER = 'YOUR_USER_ID_HERE';

SELECT 
    p.passenger_id,
    p.fullname,
    p.dob,
    p.gender,
    p.document_number,
    p.user_id,
    u.email AS user_email
FROM Passengers p
LEFT JOIN Users u ON p.user_id = u.user_id
WHERE p.user_id = @UserId
ORDER BY p.created_at DESC;
GO

-- =========================================================
-- 3. LẤY PASSENGER IDs CHƯA ĐƯỢC DÙNG TRONG BOOKING NÀO
-- =========================================================
-- Hữu ích khi muốn test tạo booking mới
SELECT 
    p.passenger_id,
    p.fullname,
    p.dob,
    p.gender,
    p.document_number,
    p.user_id
FROM Passengers p
LEFT JOIN BookingPassengers bp ON p.passenger_id = bp.passenger_id
WHERE bp.passenger_id IS NULL
ORDER BY p.created_at DESC;
GO

-- =========================================================
-- 4. LẤY PASSENGER IDs ĐÃ CÓ TRONG BOOKING
-- =========================================================
-- Hữu ích khi muốn test với passenger đã có booking
SELECT DISTINCT
    p.passenger_id,
    p.fullname,
    p.dob,
    p.gender,
    p.document_number,
    p.user_id,
    COUNT(bp.booking_id) AS total_bookings
FROM Passengers p
INNER JOIN BookingPassengers bp ON p.passenger_id = bp.passenger_id
GROUP BY p.passenger_id, p.fullname, p.dob, p.gender, p.document_number, p.user_id
ORDER BY total_bookings DESC;
GO

-- =========================================================
-- 5. LẤY PASSENGER IDs VỚI THÔNG TIN USER (Nếu có)
-- =========================================================
SELECT 
    p.passenger_id,
    p.fullname AS passenger_name,
    p.dob,
    p.gender,
    p.document_number,
    p.user_id,
    u.email AS user_email,
    u.fullname AS user_name,
    CASE 
        WHEN p.user_id IS NULL THEN 'Guest Passenger'
        ELSE 'Registered User'
    END AS passenger_type
FROM Passengers p
LEFT JOIN Users u ON p.user_id = u.user_id
ORDER BY p.created_at DESC;
GO

-- =========================================================
-- 6. LẤY 10 PASSENGER IDs MỚI NHẤT (Cho testing nhanh)
-- =========================================================
SELECT TOP 10
    passenger_id,
    fullname,
    dob,
    gender,
    document_number,
    user_id
FROM Passengers
ORDER BY created_at DESC;
GO

-- =========================================================
-- 7. LẤY PASSENGER IDs THEO USER EMAIL
-- =========================================================
-- Thay 'user@example.com' bằng email thực tế
DECLARE @UserEmail VARCHAR(100) = 'user@example.com';

SELECT 
    p.passenger_id,
    p.fullname,
    p.dob,
    p.gender,
    p.document_number,
    u.email AS user_email
FROM Passengers p
INNER JOIN Users u ON p.user_id = u.user_id
WHERE u.email = @UserEmail
ORDER BY p.created_at DESC;
GO

-- =========================================================
-- 8. LẤY PASSENGER ID ĐẦU TIÊN (Cho quick test)
-- =========================================================
SELECT TOP 1
    passenger_id,
    fullname,
    dob,
    gender,
    document_number
FROM Passengers
ORDER BY created_at DESC;
GO

-- =========================================================
-- 9. LẤY PASSENGER IDs VỚI THÔNG TIN BOOKING (Nếu có)
-- =========================================================
SELECT 
    p.passenger_id,
    p.fullname,
    p.dob,
    p.gender,
    p.document_number,
    COUNT(DISTINCT bp.booking_id) AS total_bookings,
    MAX(b.created_at) AS last_booking_date
FROM Passengers p
LEFT JOIN BookingPassengers bp ON p.passenger_id = bp.passenger_id
LEFT JOIN Bookings b ON bp.booking_id = b.booking_id
GROUP BY p.passenger_id, p.fullname, p.dob, p.gender, p.document_number
ORDER BY total_bookings DESC, last_booking_date DESC;
GO

-- =========================================================
-- 10. LẤY PASSENGER IDs CHỈ CÓ ID (Cho copy/paste nhanh)
-- =========================================================
SELECT passenger_id
FROM Passengers
ORDER BY created_at DESC;
GO

