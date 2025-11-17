-- Script đơn giản: Kiểm tra ảnh đã upload cho 1 route cụ thể
-- Thay route_id bằng route_id bạn vừa upload

USE flight_booking_db_v2; -- Thay đổi database name nếu cần
GO

-- Thay route_id này bằng route_id bạn vừa upload
DECLARE @RouteId UNIQUEIDENTIFIER = '019A8F51-24CD-74F0-B5F2-CBC06F21CA97';

SELECT 
    r.route_id AS 'Route ID',
    o.iata_code + ' -> ' + d.iata_code AS 'Route',
    r.image_url AS 'Image URL',
    r.service_link AS 'Service Link',
    CASE 
        WHEN r.image_url IS NULL OR r.image_url = '' THEN 'Chưa có image'
        WHEN r.image_url = '/images/routes/' + CAST(r.route_id AS NVARCHAR(36)) + '.jpg' THEN 'Đã có image (đúng format)'
        ELSE 'Có image (format khác)'
    END AS 'Status'
FROM dbo.Routes r
INNER JOIN dbo.Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN dbo.Airports d ON r.destination_airport_id = d.airport_id
WHERE r.route_id = @RouteId;
GO

