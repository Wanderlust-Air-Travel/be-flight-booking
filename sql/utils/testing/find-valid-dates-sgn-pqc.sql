-- ============================================================
-- TÌM CÁC NGÀY CÓ FLIGHTS CHO ROUTE SGN -> PQC
-- ============================================================

DECLARE @originIATA VARCHAR(3) = 'SGN';
DECLARE @destIATA VARCHAR(3) = 'PQC';
DECLARE @minSeats INT = 1; -- Số passengers tối thiểu

-- Tìm tất cả các ngày có flights với đủ seats
SELECT 
    fi.flight_date AS DepartDate,
    COUNT(DISTINCT fi.flight_instance_id) AS FlightCount,
    SUM(CASE WHEN fs.is_available = 1 THEN 1 ELSE 0 END) AS TotalAvailableSeats,
    MIN(fi.departure_datetime_local) AS EarliestDeparture,
    MAX(fi.departure_datetime_local) AS LatestDeparture
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
ORDER BY fi.flight_date;

-- Chi tiết từng flight cho mỗi ngày
SELECT 
    fi.flight_date AS DepartDate,
    fi.flight_instance_id,
    fi.flight_number,
    fi.departure_datetime_local,
    fi.arrival_datetime_local,
    COUNT(fs.flight_seat_id) AS TotalSeats,
    SUM(CASE WHEN fs.is_available = 1 THEN 1 ELSE 0 END) AS AvailableSeats,
    SUM(CASE WHEN fs.is_available = 0 THEN 1 ELSE 0 END) AS BookedSeats,
    CASE 
        WHEN SUM(CASE WHEN fs.is_available = 1 THEN 1 ELSE 0 END) >= @minSeats THEN 'YES'
        ELSE 'NO (Not enough seats)'
    END AS WillBeReturnedByAPI
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
    fi.flight_date,
    fi.flight_instance_id,
    fi.flight_number,
    fi.departure_datetime_local,
    fi.arrival_datetime_local
HAVING SUM(CASE WHEN fs.is_available = 1 THEN 1 ELSE 0 END) >= @minSeats
ORDER BY fi.flight_date, fi.departure_datetime_local;

-- Tóm tắt: Số ngày có flights trong khoảng thời gian
SELECT 
    'Summary' AS CheckType,
    COUNT(DISTINCT fi.flight_date) AS TotalValidDates,
    MIN(fi.flight_date) AS EarliestDate,
    MAX(fi.flight_date) AS LatestDate,
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
GROUP BY fi.flight_date
HAVING SUM(CASE WHEN fs.is_available = 1 THEN 1 ELSE 0 END) >= @minSeats;

