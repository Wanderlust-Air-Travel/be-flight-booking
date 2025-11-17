/* =========================================================
   MIGRATION: Thêm image_url và service_link vào bảng Routes
   ========================================================= */

USE flight_booking_db;
GO

-- Kiểm tra và thêm columns nếu chưa tồn tại
-- Format chuẩn (theo thực tế các doanh nghiệp):
-- image_url: '/images/routes/{route_id}.jpg' (route_id là UUID v7 - 36 ký tự)
-- service_link: '/service/{route_id}' (route_id là UUID v7 - 36 ký tự)

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Routes' AND COLUMN_NAME = 'image_url'
)
BEGIN
    ALTER TABLE Routes
    ADD image_url NVARCHAR(300) NULL;  -- Format: '/images/routes/{route_id}.jpg' (route_id là UUID v7 - 36 ký tự, length = 55)
    PRINT 'Added column: image_url';
END
ELSE
BEGIN
    PRINT 'Column image_url already exists';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Routes' AND COLUMN_NAME = 'service_link'
)
BEGIN
    ALTER TABLE Routes
    ADD service_link NVARCHAR(255) NULL; -- Format: '/service/{route_id}' (route_id là UUID v7 - 36 ký tự, length = 45)
    PRINT 'Added column: service_link';
END
ELSE
BEGIN
    PRINT 'Column service_link already exists';
END
GO

-- BƯỚC 1: XÓA CONSTRAINT CŨ TRƯỚC (nếu có) để có thể update data
PRINT 'Step 1: Dropping existing constraints (if any)...';
GO

IF EXISTS (
    SELECT 1 FROM sys.check_constraints 
    WHERE name = 'CK_Routes_ImageUrl_Format'
)
BEGIN
    ALTER TABLE Routes
    DROP CONSTRAINT CK_Routes_ImageUrl_Format;
    PRINT 'Dropped existing constraint: CK_Routes_ImageUrl_Format';
END
ELSE
BEGIN
    PRINT 'No existing constraint CK_Routes_ImageUrl_Format found';
END
GO

IF EXISTS (
    SELECT 1 FROM sys.check_constraints 
    WHERE name = 'CK_Routes_ServiceLink_Format'
)
BEGIN
    ALTER TABLE Routes
    DROP CONSTRAINT CK_Routes_ServiceLink_Format;
    PRINT 'Dropped existing constraint: CK_Routes_ServiceLink_Format';
END
ELSE
BEGIN
    PRINT 'No existing constraint CK_Routes_ServiceLink_Format found';
END
GO

-- BƯỚC 2: Cập nhật dữ liệu hiện có sang format mới
-- Chuyển từ format cũ (/s{number}.jpg) sang format mới (/images/routes/{route_id}.jpg)
-- route_id là UUID v7 (36 ký tự)
PRINT 'Step 2: Updating existing data to new format...';
GO

-- Update tất cả records: chuyển sang format mới nếu chưa đúng
UPDATE Routes
SET 
    -- Chuyển image_url từ format cũ sang format mới
    image_url = CASE 
        WHEN image_url IS NULL THEN '/images/routes/' + CAST(route_id AS VARCHAR(36)) + '.jpg'
        WHEN image_url LIKE '/images/routes/%.jpg' 
            AND LEN(image_url) = 55
            AND SUBSTRING(image_url, 16, 36) = CAST(route_id AS VARCHAR(36)) 
        THEN image_url  -- Đã đúng format, giữ nguyên
        ELSE '/images/routes/' + CAST(route_id AS VARCHAR(36)) + '.jpg'  -- Chuyển sang format mới
    END,
    -- Đảm bảo service_link đúng format
    service_link = CASE 
        WHEN service_link IS NULL THEN '/service/' + CAST(route_id AS VARCHAR(36))
        WHEN service_link LIKE '/service/%' 
            AND LEN(service_link) = 45 
            AND SUBSTRING(service_link, 10, 36) = CAST(route_id AS VARCHAR(36))
        THEN service_link  -- Đã đúng format, giữ nguyên
        ELSE '/service/' + CAST(route_id AS VARCHAR(36))  -- Chuyển sang format mới
    END;
GO

PRINT 'Step 2 completed: Data updated to new format';
GO

-- BƯỚC 3: Thêm CHECK constraints để validate format mới
-- image_url phải match pattern: '/images/routes/' + route_id (UUID v7 - 36 ký tự) + '.jpg'
PRINT 'Step 3: Adding CHECK constraints...';
GO

ALTER TABLE Routes
ADD CONSTRAINT CK_Routes_ImageUrl_Format
CHECK (
    image_url IS NULL 
    OR (
        image_url LIKE '/images/routes/%.jpg'
        AND LEN(image_url) = 55  -- '/images/routes/' (15) + UUID v7 (36) + '.jpg' (4) = 55
        AND SUBSTRING(image_url, 16, 36) = CAST(route_id AS VARCHAR(36))
    )
);
PRINT 'Added constraint: CK_Routes_ImageUrl_Format';
GO

-- Thêm constraint mới cho service_link
-- service_link phải match pattern: '/service/' + route_id (UUID v7 format)
-- Format: '/service/' (9 chars) + UUID v7 (36 chars) = 45 chars total
ALTER TABLE Routes
ADD CONSTRAINT CK_Routes_ServiceLink_Format
CHECK (
    service_link IS NULL 
    OR (
        service_link LIKE '/service/%'
        AND LEN(service_link) = 45  -- '/service/' (9) + UUID (36) = 45
        AND SUBSTRING(service_link, 10, 36) = CAST(route_id AS VARCHAR(36))
    )
);
PRINT 'Added constraint: CK_Routes_ServiceLink_Format';
GO

-- BƯỚC 4: Verify - Kiểm tra xem còn records nào không đúng format không
PRINT 'Step 4: Verifying data format...';
GO

DECLARE @InvalidImageUrlCount INT = 0;
DECLARE @InvalidServiceLinkCount INT = 0;

SELECT @InvalidImageUrlCount = COUNT(*)
FROM Routes
WHERE image_url IS NOT NULL 
    AND (
        image_url NOT LIKE '/images/routes/%.jpg'
        OR LEN(image_url) != 55
        OR SUBSTRING(image_url, 16, 36) != CAST(route_id AS VARCHAR(36))
    );

SELECT @InvalidServiceLinkCount = COUNT(*)
FROM Routes
WHERE service_link IS NOT NULL 
    AND (
        service_link NOT LIKE '/service/%'
        OR LEN(service_link) != 45
        OR SUBSTRING(service_link, 10, 36) != CAST(route_id AS VARCHAR(36))
    );

IF @InvalidImageUrlCount > 0 OR @InvalidServiceLinkCount > 0
BEGIN
    PRINT 'WARNING: Found ' + CAST(@InvalidImageUrlCount AS VARCHAR(10)) + ' invalid image_url and ' + CAST(@InvalidServiceLinkCount AS VARCHAR(10)) + ' invalid service_link';
    PRINT 'Please check the data before proceeding';
END
ELSE
BEGIN
    PRINT 'Step 4 completed: All data is in correct format';
END
GO

-- Tạo index để tối ưu query (optional) - chỉ tạo nếu chưa tồn tại
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_Routes_ImageUrl' AND object_id = OBJECT_ID('Routes')
)
BEGIN
    CREATE INDEX IX_Routes_ImageUrl ON Routes(image_url);
    PRINT 'Created index: IX_Routes_ImageUrl';
END
ELSE
BEGIN
    PRINT 'Index IX_Routes_ImageUrl already exists';
END
GO

-- Verify: Kiểm tra kết quả
SELECT TOP 10
    route_id,
    image_url,
    service_link,
    (SELECT iata_code FROM Airports WHERE airport_id = Routes.origin_airport_id) AS origin,
    (SELECT iata_code FROM Airports WHERE airport_id = Routes.destination_airport_id) AS destination
FROM Routes
WHERE is_domestic = 1
ORDER BY created_at DESC;
GO

PRINT 'Migration completed: Added image_url and service_link to Routes table';
GO

