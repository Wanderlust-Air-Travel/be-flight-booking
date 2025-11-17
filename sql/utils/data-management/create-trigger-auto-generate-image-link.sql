/* =========================================================
   TRIGGER: Tự động generate image_url và service_link theo format chuẩn
   ========================================================= */

-- Lưu ý: Thay đổi database name nếu cần (flight_booking_db hoặc flight_booking_db_v2)
-- USE flight_booking_db;
-- GO

-- Tạo trigger để tự động generate image_url và service_link khi INSERT/UPDATE
-- Format chuẩn (theo thực tế các doanh nghiệp):
-- image_url: '/images/routes/{route_id}.jpg' (dùng route_id để xác định route)
-- service_link: '/service/{route_id}' (route_id là UUID v7 - 36 ký tự)

IF EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'trg_Routes_AutoGenerateImageLink')
BEGIN
    DROP TRIGGER trg_Routes_AutoGenerateImageLink;
    PRINT 'Dropped existing trigger: trg_Routes_AutoGenerateImageLink';
END
GO

CREATE TRIGGER trg_Routes_AutoGenerateImageLink
ON Routes
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Chỉ update các records có image_url hoặc service_link NULL hoặc không đúng format
    UPDATE r
    SET 
        -- Generate image_url nếu NULL hoặc không đúng format
        image_url = CASE 
            WHEN r.image_url IS NULL 
                OR r.image_url NOT LIKE '/images/routes/%.jpg'
                OR LEN(r.image_url) != 55
                OR SUBSTRING(r.image_url, 16, 36) != CAST(r.route_id AS VARCHAR(36))
            THEN '/images/routes/' + CAST(r.route_id AS VARCHAR(36)) + '.jpg'
            ELSE r.image_url
        END,
        -- Generate service_link nếu NULL hoặc không đúng format
        service_link = CASE 
            WHEN r.service_link IS NULL 
                OR r.service_link NOT LIKE '/service/%'
                OR LEN(r.service_link) != 45
                OR SUBSTRING(r.service_link, 10, 36) != CAST(r.route_id AS VARCHAR(36))
            THEN '/service/' + CAST(r.route_id AS VARCHAR(36))
            ELSE r.service_link
        END
    FROM Routes r
    INNER JOIN inserted i ON r.route_id = i.route_id
    WHERE 
        r.image_url IS NULL 
        OR r.service_link IS NULL
        OR r.image_url NOT LIKE '/images/routes/%.jpg'
        OR LEN(r.image_url) != 55
        OR SUBSTRING(r.image_url, 16, 36) != CAST(r.route_id AS VARCHAR(36))
        OR r.service_link NOT LIKE '/service/%'
        OR LEN(r.service_link) != 45
        OR SUBSTRING(r.service_link, 10, 36) != CAST(r.route_id AS VARCHAR(36))
END
GO

PRINT 'Created trigger: trg_Routes_AutoGenerateImageLink';
PRINT 'Trigger will auto-generate image_url and service_link according to standard format';
GO

