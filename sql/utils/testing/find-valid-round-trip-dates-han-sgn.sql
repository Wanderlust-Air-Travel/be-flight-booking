-- ============================================================
-- TÌM CÁC CẶP NGÀY HỢP LỆ CHO ROUND TRIP HAN <-> SGN
-- ============================================================

DECLARE @originIATA VARCHAR(3) = 'HAN';
DECLARE @destIATA VARCHAR(3) = 'SGN';
DECLARE @minSeats INT = 1; -- Số passengers tối thiểu

-- 1. Tìm tất cả các ngày có flights cho route HAN -> SGN (outbound)
WITH OutboundDates AS (
    SELECT 
        fi.flight_date AS DepartDate,
        COUNT(DISTINCT fi.flight_instance_id) AS OutboundFlightCount,
        SUM(CASE WHEN fs.is_available = 1 THEN 1 ELSE 0 END) AS OutboundAvailableSeats
    FROM FlightInstances fi
    INNER JOIN FlightSchedules fs_schedule ON fi.flight_schedule_id = fs_schedule.flight_schedule_id
    INNER JOIN Routes r ON fs_schedule.route_id = r.route_id
    INNER JOIN Airports o ON r.origin_airport_id = o.airport_id
    INNER JOIN Airports d ON r.destination_airport_id = d.airport_id
    LEFT JOIN FlightSeats fs ON fi.flight_instance_id = fs.flight_instance_id
    WHERE o.iata_code = @originIATA 
      AND d.iata_code = @destIATA
      AND fi.status IN ('scheduled', 'on_time', 'delayed')
    GROUP BY fi.flight_date
    HAVING SUM(CASE WHEN fs.is_available = 1 THEN 1 ELSE 0 END) >= @minSeats
),
-- 2. Tìm tất cả các ngày có flights cho route SGN -> HAN (return/inbound)
ReturnDates AS (
    SELECT 
        fi.flight_date AS ReturnDate,
        COUNT(DISTINCT fi.flight_instance_id) AS ReturnFlightCount,
        SUM(CASE WHEN fs.is_available = 1 THEN 1 ELSE 0 END) AS ReturnAvailableSeats
    FROM FlightInstances fi
    INNER JOIN FlightSchedules fs_schedule ON fi.flight_schedule_id = fs_schedule.flight_schedule_id
    INNER JOIN Routes r ON fs_schedule.route_id = r.route_id
    INNER JOIN Airports o ON r.origin_airport_id = o.airport_id
    INNER JOIN Airports d ON r.destination_airport_id = d.airport_id
    LEFT JOIN FlightSeats fs ON fi.flight_instance_id = fs.flight_instance_id
    WHERE o.iata_code = @destIATA 
      AND d.iata_code = @originIATA
      AND fi.status IN ('scheduled', 'on_time', 'delayed')
    GROUP BY fi.flight_date
    HAVING SUM(CASE WHEN fs.is_available = 1 THEN 1 ELSE 0 END) >= @minSeats
)
-- 3. Tìm các cặp ngày hợp lệ (departDate < returnDate)
SELECT 
    o.DepartDate,
    r.ReturnDate,
    DATEDIFF(DAY, o.DepartDate, r.ReturnDate) AS DaysBetween,
    o.OutboundFlightCount,
    o.OutboundAvailableSeats,
    r.ReturnFlightCount,
    r.ReturnAvailableSeats,
    CASE 
        WHEN o.OutboundAvailableSeats >= @minSeats AND r.ReturnAvailableSeats >= @minSeats THEN 'YES'
        ELSE 'NO'
    END AS ValidForRoundTrip
FROM OutboundDates o
CROSS JOIN ReturnDates r
WHERE r.ReturnDate > o.DepartDate
ORDER BY o.DepartDate, r.ReturnDate;

-- 4. Tóm tắt: Số lượng cặp ngày hợp lệ
WITH OutboundDates AS (
    SELECT 
        fi.flight_date AS DepartDate,
        SUM(CASE WHEN fs.is_available = 1 THEN 1 ELSE 0 END) AS OutboundAvailableSeats
    FROM FlightInstances fi
    INNER JOIN FlightSchedules fs_schedule ON fi.flight_schedule_id = fs_schedule.flight_schedule_id
    INNER JOIN Routes r ON fs_schedule.route_id = r.route_id
    INNER JOIN Airports o ON r.origin_airport_id = o.airport_id
    INNER JOIN Airports d ON r.destination_airport_id = d.airport_id
    LEFT JOIN FlightSeats fs ON fi.flight_instance_id = fs.flight_instance_id
    WHERE o.iata_code = @originIATA 
      AND d.iata_code = @destIATA
      AND fi.status IN ('scheduled', 'on_time', 'delayed')
    GROUP BY fi.flight_date
    HAVING SUM(CASE WHEN fs.is_available = 1 THEN 1 ELSE 0 END) >= @minSeats
),
ReturnDates AS (
    SELECT 
        fi.flight_date AS ReturnDate,
        SUM(CASE WHEN fs.is_available = 1 THEN 1 ELSE 0 END) AS ReturnAvailableSeats
    FROM FlightInstances fi
    INNER JOIN FlightSchedules fs_schedule ON fi.flight_schedule_id = fs_schedule.flight_schedule_id
    INNER JOIN Routes r ON fs_schedule.route_id = r.route_id
    INNER JOIN Airports o ON r.origin_airport_id = o.airport_id
    INNER JOIN Airports d ON r.destination_airport_id = d.airport_id
    LEFT JOIN FlightSeats fs ON fi.flight_instance_id = fs.flight_instance_id
    WHERE o.iata_code = @destIATA 
      AND d.iata_code = @originIATA
      AND fi.status IN ('scheduled', 'on_time', 'delayed')
    GROUP BY fi.flight_date
    HAVING SUM(CASE WHEN fs.is_available = 1 THEN 1 ELSE 0 END) >= @minSeats
)
SELECT 
    'Summary' AS CheckType,
    COUNT(*) AS TotalValidPairs,
    MIN(o.DepartDate) AS EarliestDepartDate,
    MAX(o.DepartDate) AS LatestDepartDate,
    MIN(r.ReturnDate) AS EarliestReturnDate,
    MAX(r.ReturnDate) AS LatestReturnDate
FROM OutboundDates o
CROSS JOIN ReturnDates r
WHERE r.ReturnDate > o.DepartDate;

-- 5. Top 20 cặp ngày gần nhất (từ hôm nay)
DECLARE @today DATE = CAST(GETDATE() AS DATE);

WITH OutboundDates AS (
    SELECT 
        fi.flight_date AS DepartDate,
        COUNT(DISTINCT fi.flight_instance_id) AS OutboundFlightCount,
        SUM(CASE WHEN fs.is_available = 1 THEN 1 ELSE 0 END) AS OutboundAvailableSeats
    FROM FlightInstances fi
    INNER JOIN FlightSchedules fs_schedule ON fi.flight_schedule_id = fs_schedule.flight_schedule_id
    INNER JOIN Routes r ON fs_schedule.route_id = r.route_id
    INNER JOIN Airports o ON r.origin_airport_id = o.airport_id
    INNER JOIN Airports d ON r.destination_airport_id = d.airport_id
    LEFT JOIN FlightSeats fs ON fi.flight_instance_id = fs.flight_instance_id
    WHERE o.iata_code = @originIATA 
      AND d.iata_code = @destIATA
      AND fi.status IN ('scheduled', 'on_time', 'delayed')
      AND CAST(fi.flight_date AS DATE) >= @today
    GROUP BY fi.flight_date
    HAVING SUM(CASE WHEN fs.is_available = 1 THEN 1 ELSE 0 END) >= @minSeats
),
ReturnDates AS (
    SELECT 
        fi.flight_date AS ReturnDate,
        COUNT(DISTINCT fi.flight_instance_id) AS ReturnFlightCount,
        SUM(CASE WHEN fs.is_available = 1 THEN 1 ELSE 0 END) AS ReturnAvailableSeats
    FROM FlightInstances fi
    INNER JOIN FlightSchedules fs_schedule ON fi.flight_schedule_id = fs_schedule.flight_schedule_id
    INNER JOIN Routes r ON fs_schedule.route_id = r.route_id
    INNER JOIN Airports o ON r.origin_airport_id = o.airport_id
    INNER JOIN Airports d ON r.destination_airport_id = d.airport_id
    LEFT JOIN FlightSeats fs ON fi.flight_instance_id = fs.flight_instance_id
    WHERE o.iata_code = @destIATA 
      AND d.iata_code = @originIATA
      AND fi.status IN ('scheduled', 'on_time', 'delayed')
      AND CAST(fi.flight_date AS DATE) >= @today
    GROUP BY fi.flight_date
    HAVING SUM(CASE WHEN fs.is_available = 1 THEN 1 ELSE 0 END) >= @minSeats
)
SELECT TOP 20
    'Top 20 Nearest Valid Pairs' AS CheckType,
    o.DepartDate,
    r.ReturnDate,
    DATEDIFF(DAY, o.DepartDate, r.ReturnDate) AS DaysBetween,
    o.OutboundFlightCount,
    r.ReturnFlightCount
FROM OutboundDates o
CROSS JOIN ReturnDates r
WHERE r.ReturnDate > o.DepartDate
ORDER BY o.DepartDate, r.ReturnDate;

