-- ============================================================
-- QUERY ĐỂ KIỂM TRA FLIGHTS CHO ROUTE HAN -> DAD
-- Thay đổi @departDate để test với các ngày khác nhau
-- ============================================================

DECLARE @departDate DATE = '2025-11-18'; -- Thay đổi ngày này để test
DECLARE @originIATA VARCHAR(3) = 'HAN';
DECLARE @destIATA VARCHAR(3) = 'DAD';
DECLARE @minSeats INT = 1; -- Số passengers tối thiểu

-- 1. Kiểm tra airports
SELECT 
    'Airports' AS CheckType,
    o.airport_id AS OriginID,
    o.iata_code AS OriginIATA,
    o.name AS OriginName,
    d.airport_id AS DestID,
    d.iata_code AS DestIATA,
    d.name AS DestName
FROM Airports o
CROSS JOIN Airports d
WHERE o.iata_code = @originIATA 
  AND d.iata_code = @destIATA;

-- 2. Kiểm tra route
SELECT 
    'Route' AS CheckType,
    r.route_id,
    o.iata_code AS OriginIATA,
    d.iata_code AS DestIATA,
    r.distance_km,
    r.is_domestic
FROM Routes r
INNER JOIN Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN Airports d ON r.destination_airport_id = d.airport_id
WHERE o.iata_code = @originIATA 
  AND d.iata_code = @destIATA
  AND r.is_domestic = 1;

-- 3. Kiểm tra flight schedules cho route này
SELECT 
    'Flight Schedules' AS CheckType,
    fs.flight_schedule_id,
    fs.flight_number,
    fs.route_id,
    fs.operating_days,
    fs.departure_time_local,
    fs.arrival_time_local,
    fs.effective_from,
    fs.effective_to,
    fs.status,
    o.iata_code AS OriginIATA,
    d.iata_code AS DestIATA
FROM FlightSchedules fs
INNER JOIN Routes r ON fs.route_id = r.route_id
INNER JOIN Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN Airports d ON r.destination_airport_id = d.airport_id
WHERE o.iata_code = @originIATA 
  AND d.iata_code = @destIATA
  AND fs.status = 'active'
  AND CAST(@departDate AS DATE) BETWEEN CAST(fs.effective_from AS DATE) AND CAST(fs.effective_to AS DATE)
ORDER BY fs.flight_number;

-- 4. Kiểm tra flight instances cho ngày cụ thể
SELECT 
    'Flight Instances' AS CheckType,
    fi.flight_instance_id,
    fi.flight_number,
    fi.flight_date,
    fi.departure_datetime_local,
    fi.arrival_datetime_local,
    fi.status,
    fs.route_id,
    o.iata_code AS OriginIATA,
    d.iata_code AS DestIATA
FROM FlightInstances fi
INNER JOIN FlightSchedules fs ON fi.flight_schedule_id = fs.flight_schedule_id
INNER JOIN Routes r ON fs.route_id = r.route_id
INNER JOIN Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN Airports d ON r.destination_airport_id = d.airport_id
WHERE o.iata_code = @originIATA 
  AND d.iata_code = @destIATA
  AND CAST(fi.flight_date AS DATE) = @departDate
  AND fi.status IN ('scheduled', 'on_time', 'delayed')
ORDER BY fi.departure_datetime_local;

-- 5. Kiểm tra số seats available cho mỗi flight instance
SELECT 
    'Flight Seats Available' AS CheckType,
    fi.flight_instance_id,
    fi.flight_number,
    fi.flight_date,
    fi.departure_datetime_local,
    COUNT(fs.flight_seat_id) AS TotalSeats,
    SUM(CASE WHEN fs.is_available = 1 THEN 1 ELSE 0 END) AS AvailableSeats,
    SUM(CASE WHEN fs.is_available = 0 THEN 1 ELSE 0 END) AS BookedSeats,
    CASE 
        WHEN SUM(CASE WHEN fs.is_available = 1 THEN 1 ELSE 0 END) >= @minSeats THEN 'YES'
        ELSE 'NO'
    END AS HasEnoughSeats
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
    fi.departure_datetime_local
ORDER BY fi.departure_datetime_local;

-- 6. Tổng hợp: Flights sẽ được trả về bởi API
SELECT 
    'Final Result (What API Should Return)' AS CheckType,
    fi.flight_instance_id,
    fi.flight_number,
    fi.departure_datetime_local,
    fi.arrival_datetime_local,
    SUM(CASE WHEN fs.is_available = 1 THEN 1 ELSE 0 END) AS AvailableSeats,
    o.iata_code AS OriginIATA,
    o.name AS OriginName,
    o.city AS OriginCity,
    d.iata_code AS DestIATA,
    d.name AS DestName,
    d.city AS DestCity
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
    fi.departure_datetime_local,
    fi.arrival_datetime_local,
    o.iata_code,
    o.name,
    o.city,
    d.iata_code,
    d.name,
    d.city
HAVING SUM(CASE WHEN fs.is_available = 1 THEN 1 ELSE 0 END) >= @minSeats
ORDER BY fi.departure_datetime_local;

-- 7. Kiểm tra operating days của schedules (để xem schedule có chạy vào ngày này không)
SELECT 
    'Schedule Operating Days Check' AS CheckType,
    fs.flight_schedule_id,
    fs.flight_number,
    fs.operating_days,
    DATEPART(WEEKDAY, @departDate) AS DayOfWeek, -- 1=Sunday, 2=Monday, ..., 7=Saturday
    CASE 
        WHEN DATEPART(WEEKDAY, @departDate) = 1 AND SUBSTRING(fs.operating_days, 1, 1) = '1' THEN 'YES - Sunday'
        WHEN DATEPART(WEEKDAY, @departDate) = 2 AND SUBSTRING(fs.operating_days, 2, 1) = '1' THEN 'YES - Monday'
        WHEN DATEPART(WEEKDAY, @departDate) = 3 AND SUBSTRING(fs.operating_days, 3, 1) = '1' THEN 'YES - Tuesday'
        WHEN DATEPART(WEEKDAY, @departDate) = 4 AND SUBSTRING(fs.operating_days, 4, 1) = '1' THEN 'YES - Wednesday'
        WHEN DATEPART(WEEKDAY, @departDate) = 5 AND SUBSTRING(fs.operating_days, 5, 1) = '1' THEN 'YES - Thursday'
        WHEN DATEPART(WEEKDAY, @departDate) = 6 AND SUBSTRING(fs.operating_days, 6, 1) = '1' THEN 'YES - Friday'
        WHEN DATEPART(WEEKDAY, @departDate) = 7 AND SUBSTRING(fs.operating_days, 7, 1) = '1' THEN 'YES - Saturday'
        ELSE 'NO'
    END AS OperatesOnThisDay,
    o.iata_code AS OriginIATA,
    d.iata_code AS DestIATA
FROM FlightSchedules fs
INNER JOIN Routes r ON fs.route_id = r.route_id
INNER JOIN Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN Airports d ON r.destination_airport_id = d.airport_id
WHERE o.iata_code = @originIATA 
  AND d.iata_code = @destIATA
  AND fs.status = 'active'
  AND CAST(@departDate AS DATE) BETWEEN CAST(fs.effective_from AS DATE) AND CAST(fs.effective_to AS DATE)
ORDER BY fs.flight_number;

-- 8. Tìm ngày gần nhất có flights (nếu ngày hiện tại không có)
SELECT TOP 10
    'Nearest Dates With Flights' AS CheckType,
    fi.flight_date,
    COUNT(DISTINCT fi.flight_instance_id) AS FlightCount,
    SUM(CASE WHEN fs.is_available = 1 THEN 1 ELSE 0 END) AS TotalAvailableSeats
FROM FlightInstances fi
INNER JOIN FlightSchedules fs_schedule ON fi.flight_schedule_id = fs_schedule.flight_schedule_id
INNER JOIN Routes r ON fs_schedule.route_id = r.route_id
INNER JOIN Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN Airports d ON r.destination_airport_id = d.airport_id
LEFT JOIN FlightSeats fs ON fi.flight_instance_id = fs.flight_instance_id
WHERE o.iata_code = @originIATA 
  AND d.iata_code = @destIATA
  AND fi.status IN ('scheduled', 'on_time', 'delayed')
  AND CAST(fi.flight_date AS DATE) >= @departDate
GROUP BY fi.flight_date
HAVING SUM(CASE WHEN fs.is_available = 1 THEN 1 ELSE 0 END) >= @minSeats
ORDER BY fi.flight_date;

