-- ============================================================
-- QUERY NHANH ĐỂ KIỂM TRA FLIGHTS HAN -> DAD
-- Thay đổi @departDate để test với các ngày khác nhau
-- ============================================================

DECLARE @departDate DATE = '2025-11-18'; -- THAY ĐỔI NGÀY NÀY ĐỂ TEST
DECLARE @originIATA VARCHAR(3) = 'HAN';
DECLARE @destIATA VARCHAR(3) = 'DAD';
DECLARE @minSeats INT = 1;

-- QUERY CHÍNH: Tìm flights sẽ được trả về bởi API
SELECT 
    fi.flight_instance_id,
    fi.flight_number,
    fi.flight_date,
    fi.departure_datetime_local,
    fi.arrival_datetime_local,
    fi.status,
    COUNT(fs.flight_seat_id) AS TotalSeats,
    SUM(CASE WHEN fs.is_available = 1 THEN 1 ELSE 0 END) AS AvailableSeats,
    SUM(CASE WHEN fs.is_available = 0 THEN 1 ELSE 0 END) AS BookedSeats,
    CASE 
        WHEN SUM(CASE WHEN fs.is_available = 1 THEN 1 ELSE 0 END) >= @minSeats THEN 'YES'
        ELSE 'NO (Not enough seats)'
    END AS WillBeReturnedByAPI,
    o.iata_code AS OriginIATA,
    d.iata_code AS DestIATA
FROM FlightInstances fi
INNER JOIN FlightSchedules fs_schedule ON fi.flight_schedule_id = fs_schedule.flight_schedule_id
INNER JOIN Routes r ON fs_schedule.route_id = r.route_id
INNER JOIN Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN Airports d ON r.destination_airport_id = d.airport_id
LEFT JOIN FlightSeats fs ON fi.flight_instance_id = fs.flight_instance_id
WHERE o.iata_code = @originIATA 
  AND d.iata_code = @destIATA
  AND CAST(fi.flight_date AS DATE) = @departDate
  AND fi.status IN ('scheduled', 'on_time', 'delayed')
GROUP BY 
    fi.flight_instance_id,
    fi.flight_number,
    fi.flight_date,
    fi.departure_datetime_local,
    fi.arrival_datetime_local,
    fi.status,
    o.iata_code,
    d.iata_code
ORDER BY fi.departure_datetime_local;

-- Nếu không có kết quả, kiểm tra:
-- 1. Có route không?
SELECT 'Route Check' AS CheckType, COUNT(*) AS RouteCount
FROM Routes r
INNER JOIN Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN Airports d ON r.destination_airport_id = d.airport_id
WHERE o.iata_code = @originIATA 
  AND d.iata_code = @destIATA
  AND r.is_domestic = 1;

-- 2. Có schedules không?
SELECT 'Schedules Check' AS CheckType, COUNT(*) AS ScheduleCount
FROM FlightSchedules fs
INNER JOIN Routes r ON fs.route_id = r.route_id
INNER JOIN Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN Airports d ON r.destination_airport_id = d.airport_id
WHERE o.iata_code = @originIATA 
  AND d.iata_code = @destIATA
  AND fs.status = 'active'
  AND CAST(@departDate AS DATE) BETWEEN CAST(fs.effective_from AS DATE) AND CAST(fs.effective_to AS DATE);

-- 3. Có instances cho ngày này không?
SELECT 'Instances Check' AS CheckType, COUNT(*) AS InstanceCount
FROM FlightInstances fi
INNER JOIN FlightSchedules fs ON fi.flight_schedule_id = fs.flight_schedule_id
INNER JOIN Routes r ON fs.route_id = r.route_id
INNER JOIN Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN Airports d ON r.destination_airport_id = d.airport_id
WHERE o.iata_code = @originIATA 
  AND d.iata_code = @destIATA
  AND CAST(fi.flight_date AS DATE) = @departDate
  AND fi.status IN ('scheduled', 'on_time', 'delayed');

-- 4. Tìm ngày gần nhất có flights
SELECT TOP 5
    'Nearest Dates' AS CheckType,
    fi.flight_date,
    COUNT(DISTINCT fi.flight_instance_id) AS FlightCount
FROM FlightInstances fi
INNER JOIN FlightSchedules fs_schedule ON fi.flight_schedule_id = fs_schedule.flight_schedule_id
INNER JOIN Routes r ON fs_schedule.route_id = r.route_id
INNER JOIN Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN Airports d ON r.destination_airport_id = d.airport_id
WHERE o.iata_code = @originIATA 
  AND d.iata_code = @destIATA
  AND fi.status IN ('scheduled', 'on_time', 'delayed')
  AND CAST(fi.flight_date AS DATE) >= @departDate
GROUP BY fi.flight_date
ORDER BY fi.flight_date;

