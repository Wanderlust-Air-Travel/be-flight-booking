-- ============================================================
-- FIND VALID BOOKING IDs FOR PAYMENT PROCESSING
-- ============================================================
-- Mục đích: Tìm booking IDs hợp lệ để test payment APIs
-- 
-- APIs:
-- 1. POST /payments/bookings/:bookingId (Create payment)
--    Request Body:
--    {
--      "paymentMethodCode": "CREDIT_CARD" | "DEBIT_CARD" | "BANK_TRANSFER" | "EWALLET" | "CASH",
--      "transactionRef": "TXN123456789" (optional)
--    }
--
-- 2. POST /payments/bookings/:bookingId/process (Process payment)
--    Request Body: Same as above
-- 
-- Điều kiện hợp lệ:
-- 1. Booking status = 'pending' (chưa thanh toán)
-- 2. Booking không bị cancelled
-- 3. Có thể có payment pending hoặc chưa có payment
-- 4. Booking phải tồn tại và có user
-- 
-- Payment Methods available:
-- - CREDIT_CARD
-- - DEBIT_CARD
-- - BANK_TRANSFER
-- - EWALLET
-- - CASH
-- ============================================================

USE flight_booking_db;
GO

-- ============================================================
-- OPTION 1: Tìm booking IDs với status = 'pending' (chưa có payment hoặc payment pending)
-- ============================================================
SELECT TOP 10
    b.booking_id,
    b.pnr_code,
    b.status AS booking_status,
    b.total_amount,
    b.currency_code,
    b.contact_email,
    b.contact_phone,
    b.created_at,
    -- Payment info (nếu có)
    p.payment_id,
    p.status AS payment_status,
    p.payment_method_code,
    p.expires_at,
    -- User info
    u.user_id,
    u.email AS user_email
FROM [dbo].[Bookings] b
LEFT JOIN [dbo].[Payments] p ON p.booking_id = b.booking_id
LEFT JOIN [dbo].[Users] u ON u.user_id = b.user_id
WHERE 
    b.status = 'pending'  -- Booking chưa thanh toán
    AND (p.payment_id IS NULL OR p.status = 'pending')  -- Chưa có payment hoặc payment pending
ORDER BY b.created_at DESC;
GO

-- ============================================================
-- OPTION 2: Tìm booking IDs với payment status = 'pending' (có thể retry)
-- ============================================================
SELECT TOP 10
    b.booking_id,
    b.pnr_code,
    b.status AS booking_status,
    b.total_amount,
    p.payment_id,
    p.status AS payment_status,
    p.payment_method_code,
    p.expires_at,
    CASE 
        WHEN p.expires_at < GETDATE() THEN 'EXPIRED'
        ELSE 'VALID'
    END AS expiration_status
FROM [dbo].[Bookings] b
INNER JOIN [dbo].[Payments] p ON p.booking_id = b.booking_id
WHERE 
    b.status = 'pending'
    AND p.status = 'pending'  -- Payment pending
ORDER BY p.created_at DESC;
GO

-- ============================================================
-- OPTION 3: Tìm booking IDs chưa có payment nào (đơn giản nhất để test)
-- ============================================================
SELECT TOP 5
    b.booking_id,
    b.pnr_code,
    b.status AS booking_status,
    b.total_amount,
    b.currency_code,
    b.contact_email,
    u.user_id,
    u.email AS user_email
FROM [dbo].[Bookings] b
LEFT JOIN [dbo].[Users] u ON u.user_id = b.user_id
WHERE 
    b.status = 'pending'
    AND NOT EXISTS (
        SELECT 1 
        FROM [dbo].[Payments] p 
        WHERE p.booking_id = b.booking_id
    )
ORDER BY b.created_at DESC;
GO

-- ============================================================
-- OPTION 4: Tìm booking ID ngẫu nhiên hợp lệ (để test nhanh)
-- ============================================================
SELECT TOP 1
    b.booking_id AS bookingId,
    b.pnr_code AS pnrCode,
    b.status AS bookingStatus,
    b.total_amount AS totalAmount,
    b.currency_code AS currencyCode,
    b.contact_email AS contactEmail,
    u.user_id AS userId,
    u.email AS userEmail,
    -- Payment method available
    pm.payment_method_code AS recommendedPaymentMethod
FROM [dbo].[Bookings] b
LEFT JOIN [dbo].[Users] u ON u.user_id = b.user_id
CROSS APPLY (
    SELECT TOP 1 payment_method_code 
    FROM [dbo].[PaymentMethods] 
    WHERE is_active = 1 
    ORDER BY NEWID()
) pm
WHERE 
    b.status = 'pending'
ORDER BY NEWID();
GO

-- ============================================================
-- OPTION 5: Tìm booking IDs với payment failed (để test retry)
-- ============================================================
SELECT TOP 5
    b.booking_id,
    b.pnr_code,
    b.status AS booking_status,
    p.payment_id,
    p.status AS payment_status,
    p.payment_method_code,
    p.created_at AS payment_created_at
FROM [dbo].[Bookings] b
INNER JOIN [dbo].[Payments] p ON p.booking_id = b.booking_id
WHERE 
    b.status = 'pending'
    AND p.status = 'failed'  -- Payment failed, có thể retry
ORDER BY p.created_at DESC;
GO

-- ============================================================
-- OPTION 6: Tìm booking ID cụ thể bằng PNR code (nếu biết PNR)
-- ============================================================
-- Thay 'ABC123' bằng PNR code bạn muốn tìm
-- SELECT 
--     b.booking_id,
--     b.pnr_code,
--     b.status,
--     b.total_amount
-- FROM [dbo].[Bookings] b
-- WHERE b.pnr_code = 'ABC123';
-- GO

