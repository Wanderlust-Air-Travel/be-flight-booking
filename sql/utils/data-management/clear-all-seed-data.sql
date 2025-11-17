-- ============================================================
-- SCRIPT XÓA TOÀN BỘ DATA ĐỂ CHẠY LẠI SEED
-- Chạy script này trước khi chạy lại npm run seed:full
-- ============================================================

USE flight_booking_db_v2;
GO

BEGIN TRANSACTION;

BEGIN TRY
    -- ============================================================
    -- XÓA THEO THỨ TỰ: TỪ CHILD TABLES ĐẾN PARENT TABLES
    -- ============================================================

    -- 1. Xóa các bảng liên quan đến Bookings (child tables)
    PRINT 'Deleting Tickets...';
    DELETE FROM [dbo].[Tickets];
    PRINT '  Deleted Tickets';

    PRINT 'Deleting Payments...';
    DELETE FROM [dbo].[Payments];
    PRINT '  Deleted Payments';

    PRINT 'Deleting BookingSegments...';
    DELETE FROM [dbo].[BookingSegments];
    PRINT '  Deleted BookingSegments';

    PRINT 'Deleting BookingPassengers...';
    DELETE FROM [dbo].[BookingPassengers];
    PRINT '  Deleted BookingPassengers';

    PRINT 'Deleting Bookings...';
    DELETE FROM [dbo].[Bookings];
    PRINT '  Deleted Bookings';

    -- 2. Xóa FlightSeats (child của FlightInstances)
    PRINT 'Deleting FlightSeats...';
    DELETE FROM [dbo].[FlightSeats];
    PRINT '  Deleted FlightSeats';

    -- 3. Xóa FlightInstances (child của FlightSchedules, Aircrafts)
    PRINT 'Deleting FlightInstances...';
    DELETE FROM [dbo].[FlightInstances];
    PRINT '  Deleted FlightInstances';

    -- 4. Xóa FlightSchedules (child của Routes, AircraftTypes)
    PRINT 'Deleting FlightSchedules...';
    DELETE FROM [dbo].[FlightSchedules];
    PRINT '  Deleted FlightSchedules';

    -- 5. Xóa Routes (child của Airports)
    PRINT 'Deleting Routes...';
    DELETE FROM [dbo].[Routes];
    PRINT '  Deleted Routes';

    -- 6. Xóa Passengers (child của Users)
    PRINT 'Deleting Passengers...';
    DELETE FROM [dbo].[Passengers];
    PRINT '  Deleted Passengers';

    -- 7. Xóa Users
    PRINT 'Deleting Users...';
    DELETE FROM [dbo].[Users];
    PRINT '  Deleted Users';

    -- 8. Xóa Aircrafts (child của AircraftTypes)
    PRINT 'Deleting Aircrafts...';
    DELETE FROM [dbo].[Aircrafts];
    PRINT '  Deleted Aircrafts';

    -- 9. Xóa SeatConfigurations (child của AircraftTypes, CabinClasses)
    PRINT 'Deleting SeatConfigurations...';
    DELETE FROM [dbo].[SeatConfigurations];
    PRINT '  Deleted SeatConfigurations';

    -- 10. Xóa FareClasses (child của CabinClasses)
    PRINT 'Deleting FareClasses...';
    DELETE FROM [dbo].[FareClasses];
    PRINT '  Deleted FareClasses';

    -- 11. Xóa các bảng parent (không có foreign keys)
    PRINT 'Deleting Airports...';
    DELETE FROM [dbo].[Airports];
    PRINT '  Deleted Airports';

    PRINT 'Deleting AircraftTypes...';
    DELETE FROM [dbo].[AircraftTypes];
    PRINT '  Deleted AircraftTypes';

    PRINT 'Deleting CabinClasses...';
    DELETE FROM [dbo].[CabinClasses];
    PRINT '  Deleted CabinClasses';

    -- 12. Xóa Currencies và PaymentMethods (có thể giữ lại hoặc xóa)
    -- Nếu muốn giữ lại master data, comment 2 dòng dưới
    PRINT 'Deleting Currencies...';
    DELETE FROM [dbo].[Currencies];
    PRINT '  Deleted Currencies';

    PRINT 'Deleting PaymentMethods...';
    DELETE FROM [dbo].[PaymentMethods];
    PRINT '  Deleted PaymentMethods';

    COMMIT TRANSACTION;
    PRINT '';
    PRINT 'SUCCESS: All data deleted successfully!';
    PRINT 'You can now run: npm run seed:full';
    
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    PRINT '';
    PRINT 'ERROR: ' + ERROR_MESSAGE();
    PRINT 'Transaction rolled back.';
END CATCH;
GO

