-- ============================================================
-- Script test connection với user maxnoah
-- Chạy script này để test xem login có hoạt động không
-- ============================================================

-- Lưu ý: Script này chỉ để test. 
-- Để chạy được, bạn cần kết nối với SQL Server bằng user khác (như sa)
-- và sau đó test login maxnoah

USE master;
GO

-- Test 1: Kiểm tra login có tồn tại và enabled không
PRINT '========================================';
PRINT 'Test 1: Kiểm tra Login maxnoah';
PRINT '========================================';
IF EXISTS (SELECT * FROM sys.server_principals WHERE name = 'maxnoah')
BEGIN
    DECLARE @IsDisabled BIT;
    SELECT @IsDisabled = is_disabled 
    FROM sys.server_principals 
    WHERE name = 'maxnoah';
    
    IF @IsDisabled = 0
        PRINT '✅ Login maxnoah exists and is ENABLED';
    ELSE
        PRINT '❌ Login maxnoah exists but is DISABLED';
        PRINT '   Run: ALTER LOGIN maxnoah ENABLE;';
END
ELSE
BEGIN
    PRINT '❌ Login maxnoah does not exist';
    PRINT '   Run setup-database-user.sql first';
END
GO

-- Test 2: Kiểm tra database user
PRINT '';
PRINT '========================================';
PRINT 'Test 2: Kiểm tra Database User';
PRINT '========================================';
USE flight_booking_db;
GO

IF EXISTS (SELECT * FROM sys.database_principals WHERE name = 'maxnoah')
BEGIN
    PRINT '✅ User maxnoah exists in database flight_booking_db';
    
    -- Kiểm tra quyền
    IF EXISTS (
        SELECT 1 
        FROM sys.database_role_members rm
        INNER JOIN sys.database_principals r ON rm.role_principal_id = r.principal_id
        INNER JOIN sys.database_principals dp ON rm.member_principal_id = dp.principal_id
        WHERE dp.name = 'maxnoah' AND r.name = 'db_owner'
    )
    BEGIN
        PRINT '✅ User maxnoah has db_owner role';
    END
    ELSE
    BEGIN
        PRINT '⚠️  User maxnoah does not have db_owner role';
        PRINT '   Run: ALTER ROLE db_owner ADD MEMBER maxnoah;';
    END
END
ELSE
BEGIN
    PRINT '❌ User maxnoah does not exist in database';
    PRINT '   Run setup-database-user.sql first';
END
GO

-- Test 3: Thử kết nối (simulate)
PRINT '';
PRINT '========================================';
PRINT 'Test 3: Hướng dẫn test connection';
PRINT '========================================';
PRINT 'Để test connection từ Node.js/TypeScript:';
PRINT '';
PRINT '1. Đảm bảo file .env có:';
PRINT '   DB_USER=maxnoah';
PRINT '   DB_PASS=12341234';
PRINT '   DB_NAME=flight_booking_db';
PRINT '   DB_HOST=localhost';
PRINT '   DB_PORT=1434';
PRINT '';
PRINT '2. Test trong SSMS:';
PRINT '   - Server: localhost';
PRINT '   - Authentication: SQL Server Authentication';
PRINT '   - Login: maxnoah';
PRINT '   - Password: 12341234';
PRINT '   - Database: flight_booking_db';
PRINT '';
PRINT '3. Nếu vẫn lỗi, chạy: fix-login-issues.sql';
PRINT '========================================';
GO

