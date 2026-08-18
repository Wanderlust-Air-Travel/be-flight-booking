-- Insert test users (one per role) if they don't exist
-- Password (bcrypt): $2b$10$CpVWzSAAEvLc7DRQEXgySOxod9liHYFLYvq9etUHl6MZ6ozYX6kay = "Password123!"

SET NOCOUNT ON;

DECLARE @passwordHash NVARCHAR(255) = '$2b$10$CpVWzSAAEvLc7DRQEXgySOxod9liHYFLYvq9etUHl6MZ6ozYX6kay';

-- Role -> email, fullname, phone
DECLARE @users TABLE (role_code VARCHAR(50), email NVARCHAR(255), fullname NVARCHAR(255), phone NVARCHAR(20));
INSERT INTO @users VALUES
    ('CUSTOMER',             'customer@flightbooking.com',             N'Test Customer',                '0900000010'),
    ('TRAVEL_AGENT',         'travel_agent@flightbooking.com',         N'Test Travel Agent',            '0900000011'),
    ('SCHEDULE_PLANNER',     'schedule_planner@flightbooking.com',     N'Test Schedule Planner',        '0900000012'),
    ('REVENUE_ANALYST',      'revenue_analyst@flightbooking.com',      N'Test Revenue Analyst',         '0900000013'),
    ('ANCILLARY_MANAGER',    'ancillary_manager@flightbooking.com',    N'Test Ancillary Manager',       '0900000014'),
    ('CALL_CENTER',          'call_center@flightbooking.com',          N'Test Call Center',             '0900000015'),
    ('ACCOUNTING_STAFF',     'accounting_staff@flightbooking.com',     N'Test Accounting Staff',        '0900000016'),
    ('DISTRIBUTION_MANAGER', 'distribution_manager@flightbooking.com', N'Test Distribution Manager',    '0900000017'),
    ('FRAUD_ANALYST',        'fraud_analyst@flightbooking.com',        N'Test Fraud Analyst',           '0900000018');

DECLARE @role_code VARCHAR(50), @email NVARCHAR(255), @fullname NVARCHAR(255), @phone NVARCHAR(20);
DECLARE user_cursor CURSOR FOR SELECT role_code, email, fullname, phone FROM @users;

OPEN user_cursor;
FETCH NEXT FROM user_cursor INTO @role_code, @email, @fullname, @phone;

WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE @user_id UNIQUEIDENTIFIER = NEWID();

    IF NOT EXISTS (SELECT 1 FROM Users WHERE email = @email)
    BEGIN
        INSERT INTO Users (user_id, fullname, email, password_hash, phone, is_active, created_at, updated_at)
        VALUES (@user_id, @fullname, @email, @passwordHash, @phone, 1, GETDATE(), GETDATE());
        PRINT 'Created user: ' + @email;
    END
    ELSE
    BEGIN
        SELECT @user_id = user_id FROM Users WHERE email = @email;
    END

    IF NOT EXISTS (SELECT 1 FROM UserRoles WHERE user_id = @user_id AND role_code = @role_code)
    BEGIN
        INSERT INTO UserRoles (user_id, role_code) VALUES (@user_id, @role_code);
        PRINT 'Assigned role ' + @role_code + ' to ' + @email;
    END

    FETCH NEXT FROM user_cursor INTO @role_code, @email, @fullname, @phone;
END

CLOSE user_cursor;
DEALLOCATE user_cursor;

-- Verify
PRINT '--- Final users + roles ---';
SELECT u.email, r.role_code
FROM Users u
LEFT JOIN UserRoles ur ON u.user_id = ur.user_id
LEFT JOIN Roles r ON ur.role_code = r.role_code
ORDER BY u.email;
