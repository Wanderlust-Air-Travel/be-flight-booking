-- ============================================================
-- KIỂM TRA XEM CÓ FLIGHT INSTANCES NÀO CHO ROUTE HAN-DAD KHÔNG
-- (Bất kỳ ngày nào)
-- ============================================================

DECLARE @originIATA VARCHAR(3) = 'HAN';
DECLARE @destIATA VARCHAR(3) = 'DAD';

-- 1. Kiểm tra xem có instances nào cho route HAN-DAD không (bất kỳ ngày nào)
SELECT 
    'Flight Instances for HAN-DAD (Any Date)' AS CheckType,
    fi.flight_instance_id,
    fi.flight_number,
    fi.flight_date,
    fi.departure_datetime_local,
    fi.arrival_datetime_local,
    fi.status,
    COUNT(fs.flight_seat_id) AS TotalSeats,
    SUM(CASE WHEN fs.is_available = 1 THEN 1 ELSE 0 END) AS AvailableSeats
FROM FlightInstances fi
INNER JOIN FlightSchedules fs_schedule ON fi.flight_schedule_id = fs_schedule.flight_schedule_id
INNER JOIN Routes r ON fs_schedule.route_id = r.route_id
INNER JOIN Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN Airports d ON r.destination_airport_id = d.airport_id
LEFT JOIN FlightSeats fs ON fi.flight_instance_id = fs.flight_instance_id
WHERE o.iata_code = @originIATA 
  AND d.iata_code = @destIATA
  AND fi.status IN ('scheduled', 'on_time', 'delayed')
GROUP BY 
    fi.flight_instance_id,
    fi.flight_number,
    fi.flight_date,
    fi.departure_datetime_local,
    fi.arrival_datetime_local,
    fi.status
ORDER BY fi.flight_date, fi.departure_datetime_local;

-- 2. Kiểm tra xem schedules của HAN-DAD có nằm trong 50 schedules đầu tiên không
-- (Dựa vào flight_schedule_id - schedules được tạo theo thứ tự)
SELECT 
    'Schedules Order Check' AS CheckType,
    fs.flight_schedule_id,
    fs.flight_number,
    fs.route_id,
    o.iata_code AS OriginIATA,
    d.iata_code AS DestIATA,
    ROW_NUMBER() OVER (ORDER BY fs.flight_schedule_id) AS ScheduleOrder,
    CASE 
        WHEN ROW_NUMBER() OVER (ORDER BY fs.flight_schedule_id) <= 50 THEN '✅ YES (Will have instances)'
        ELSE '❌ NO (Won''t have instances - only first 50 schedules are processed)'
    END AS WillHaveInstances
FROM FlightSchedules fs
INNER JOIN Routes r ON fs.route_id = r.route_id
INNER JOIN Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN Airports d ON r.destination_airport_id = d.airport_id
WHERE o.iata_code = @originIATA 
  AND d.iata_code = @destIATA
  AND fs.status = 'active'
ORDER BY fs.flight_schedule_id;

-- 3. Đếm tổng số instances cho route HAN-DAD
SELECT 
    'Total Instances Count' AS CheckType,
    COUNT(DISTINCT fi.flight_instance_id) AS TotalInstances,
    MIN(fi.flight_date) AS EarliestDate,
    MAX(fi.flight_date) AS LatestDate
FROM FlightInstances fi
INNER JOIN FlightSchedules fs ON fi.flight_schedule_id = fs.flight_schedule_id
INNER JOIN Routes r ON fs.route_id = r.route_id
INNER JOIN Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN Airports d ON r.destination_airport_id = d.airport_id
WHERE o.iata_code = @originIATA 
  AND d.iata_code = @destIATA
  AND fi.status IN ('scheduled', 'on_time', 'delayed');

-- 4. Xem tất cả schedules và thứ tự của chúng (để biết HAN-DAD ở vị trí nào)
SELECT TOP 100
    'All Schedules Order' AS CheckType,
    ROW_NUMBER() OVER (ORDER BY fs.flight_schedule_id) AS ScheduleOrder,
    fs.flight_schedule_id,
    fs.flight_number,
    o.iata_code AS OriginIATA,
    d.iata_code AS DestIATA,
    CASE 
        WHEN ROW_NUMBER() OVER (ORDER BY fs.flight_schedule_id) <= 50 THEN '✅ YES'
        ELSE '❌ NO'
    END AS InFirst50
FROM FlightSchedules fs
INNER JOIN Routes r ON fs.route_id = r.route_id
INNER JOIN Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN Airports d ON r.destination_airport_id = d.airport_id
WHERE fs.status = 'active'
ORDER BY fs.flight_schedule_id;

