-- ============================================================
-- GET BOOKING ID FOR PAYMENT TESTING
-- ============================================================
-- Mục đích: Lấy booking ID hợp lệ và thông tin cần thiết để test payment API
-- API: POST {{base_url}}/payments/bookings/:bookingId
-- 
-- Request Body cần:
-- {
--   "paymentMethodCode": "CREDIT_CARD" | "DEBIT_CARD" | "BANK_TRANSFER" | "EWALLET" | "CASH",
--   "transactionRef": "TXN123456789" (optional)
-- }
-- ============================================================

USE flight_booking_db;
GO

-- ============================================================
-- OPTION 1: Lấy 1 booking ID ngẫu nhiên hợp lệ (nhanh nhất)
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
    -- Payment methods available
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
    b.status = 'pending'  -- Booking chưa thanh toán
ORDER BY NEWID();
GO

-- ============================================================
-- OPTION 2: Lấy danh sách booking IDs hợp lệ (TOP 10)
-- ============================================================
SELECT TOP 10
    b.booking_id AS bookingId,
    b.pnr_code AS pnrCode,
    b.status AS bookingStatus,
    b.total_amount AS totalAmount,
    b.currency_code AS currencyCode,
    -- Payment methods available (comma-separated)
    STRING_AGG(pm.payment_method_code, ', ') WITHIN GROUP (ORDER BY pm.payment_method_code) AS availablePaymentMethods
FROM [dbo].[Bookings] b
LEFT JOIN [dbo].[PaymentMethods] pm ON pm.is_active = 1
WHERE 
    b.status = 'pending'  -- Booking chưa thanh toán
    AND NOT EXISTS (
        SELECT 1 
        FROM [dbo].[Payments] p 
        WHERE p.booking_id = b.booking_id 
        AND p.status = 'success'  -- Chưa có payment thành công
    )
GROUP BY 
    b.booking_id,
    b.pnr_code,
    b.status,
    b.total_amount,
    b.currency_code
ORDER BY b.created_at DESC;
GO

-- ============================================================
-- OPTION 3: Lấy booking ID với thông tin payment methods active
-- ============================================================
SELECT TOP 5
    b.booking_id AS bookingId,
    b.pnr_code AS pnrCode,
    b.status AS bookingStatus,
    b.total_amount AS totalAmount,
    b.currency_code AS currencyCode,
    -- List all active payment methods
    (
        SELECT STRING_AGG(pm.payment_method_code, ', ') 
        FROM [dbo].[PaymentMethods] pm 
        WHERE pm.is_active = 1
    ) AS availablePaymentMethods
FROM [dbo].[Bookings] b
WHERE 
    b.status = 'pending'  -- Booking chưa thanh toán
ORDER BY b.created_at DESC;
GO

