-- ============================================================
-- SCRIPT CẬP NHẬT TẤT CẢ AIRCRAFT TYPES VỀ 180 GHẾ
-- Chạy script này để cập nhật dữ liệu hiện có trong DB
-- ============================================================
-- 
-- LƯU Ý:
-- - Script này sẽ cập nhật tất cả aircraft types về 180 ghế
-- - Seat configurations hiện tại sẽ bị xóa (vì cần recreate theo 180 ghế)
-- - Sau khi chạy script, cần re-run seed để tạo lại seat configurations
-- - Hoặc chạy clear-all-seed-data.sql rồi seed lại toàn bộ
-- ============================================================

USE flight_booking_db;
GO

BEGIN TRANSACTION;

BEGIN TRY
    PRINT '============================================================';
    PRINT 'CẬP NHẬT AIRCRAFT TYPES VỀ 180 GHẾ';
    PRINT '============================================================';
    PRINT '';

    -- 1. Xóa SeatConfigurations hiện tại (cần recreate theo 180 ghế)
    PRINT 'Bước 1: Xóa SeatConfigurations hiện tại...';
    
    -- Xóa FlightSeats trước (vì có foreign key đến SeatConfigurations)
    DELETE FROM [dbo].[FlightSeats];
    PRINT '  - Đã xóa FlightSeats';
    
    -- Xóa SeatConfigurations
    DELETE FROM [dbo].[SeatConfigurations];
    PRINT '  - Đã xóa SeatConfigurations';
    PRINT '';

    -- 2. Cập nhật tất cả AircraftTypes về 180 ghế
    PRINT 'Bước 2: Cập nhật tất cả AircraftTypes về 180 ghế...';
    
    DECLARE @UpdatedCount INT;
    
    UPDATE [dbo].[AircraftTypes]
    SET total_seats = 180
    WHERE total_seats != 180;
    
    SET @UpdatedCount = @@ROWCOUNT;
    
    PRINT '  - Đã cập nhật ' + CAST(@UpdatedCount AS VARCHAR(10)) + ' aircraft types về 180 ghế';
    PRINT '';

    -- 3. Hiển thị kết quả
    PRINT 'Bước 3: Kiểm tra kết quả...';
    SELECT 
        code AS [Aircraft Code],
        manufacturer AS [Manufacturer],
        model AS [Model],
        total_seats AS [Total Seats]
    FROM [dbo].[AircraftTypes]
    ORDER BY code;
    PRINT '';

    COMMIT TRANSACTION;
    PRINT '============================================================';
    PRINT 'THÀNH CÔNG: Đã cập nhật tất cả aircraft types về 180 ghế!';
    PRINT '============================================================';
    PRINT '';
    PRINT 'LƯU Ý:';
    PRINT '  - SeatConfigurations đã bị xóa';
    PRINT '  - Cần chạy lại seed script để tạo lại seat configurations';
    PRINT '  - Hoặc chạy: npm run seed:full để seed lại toàn bộ';
    PRINT '';
    
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    PRINT '';
    PRINT '============================================================';
    PRINT 'LỖI: ' + ERROR_MESSAGE();
    PRINT '============================================================';
    PRINT 'Transaction đã được rollback.';
    PRINT '';
END CATCH;
GO

