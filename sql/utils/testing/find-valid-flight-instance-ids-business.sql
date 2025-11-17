-- ============================================================
-- TÌM CÁC FLIGHT INSTANCE ID HỢP LỆ CHO API FARE-OPTIONS (BUSINESS)
-- API: GET /search/fare-options?flightInstanceId={{flightInstanceId}}&cabinType=business
-- ============================================================

DECLARE @cabinType VARCHAR(10) = 'business'; -- Business cabin type
DECLARE @minSeats INT = 1;

-- Mapping cabin type to cabin class codes
-- Business: 'J'

-- 1. Tìm tất cả flight instances có seats available cho business cabin
SELECT 
    fi.flight_instance_id AS FlightInstanceId,
    fi.flight_number,
    fi.flight_date,
    fi.departure_datetime_local,
    fi.arrival_datetime_local,
    fi.status,
    o.iata_code AS OriginIATA,
    o.name AS OriginName,
    d.iata_code AS DestIATA,
    d.name AS DestName,
    COUNT(DISTINCT CASE 
        WHEN sc.cabin_class_code = 'J' AND fs.is_available = 1 
        THEN fs.flight_seat_id 
        ELSE NULL 
    END) AS BusinessAvailableSeats,
    COUNT(DISTINCT fs.flight_seat_id) AS TotalSeats,
    COUNT(DISTINCT CASE WHEN fs.is_available = 1 THEN fs.flight_seat_id ELSE NULL END) AS TotalAvailableSeats
FROM FlightInstances fi
INNER JOIN FlightSchedules fs_schedule ON fi.flight_schedule_id = fs_schedule.flight_schedule_id
INNER JOIN Routes r ON fs_schedule.route_id = r.route_id
INNER JOIN Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN Airports d ON r.destination_airport_id = d.airport_id
INNER JOIN FlightSeats fs ON fi.flight_instance_id = fs.flight_instance_id
INNER JOIN SeatConfigurations sc ON fs.seat_config_id = sc.seat_config_id
INNER JOIN CabinClasses cc ON sc.cabin_class_code = cc.cabin_class_code
WHERE fi.status IN ('scheduled', 'on_time', 'delayed')
  AND cc.cabin_class_code = 'J'
GROUP BY 
    fi.flight_instance_id,
    fi.flight_number,
    fi.flight_date,
    fi.departure_datetime_local,
    fi.arrival_datetime_local,
    fi.status,
    o.iata_code,
    o.name,
    d.iata_code,
    d.name
HAVING COUNT(DISTINCT CASE 
    WHEN sc.cabin_class_code = 'J' AND fs.is_available = 1 
    THEN fs.flight_seat_id 
    ELSE NULL 
END) >= @minSeats
ORDER BY fi.flight_date, fi.departure_datetime_local;

-- 2. Query đơn giản: Chỉ lấy flightInstanceId và route (để copy vào Postman)
-- Khuyến nghị dùng query này để lấy flightInstanceId nhanh nhất
DECLARE @today DATE = CAST(GETDATE() AS DATE);

SELECT TOP 50
    fi.flight_instance_id AS FlightInstanceId,
    fi.flight_number,
    fi.flight_date,
    o.iata_code + ' -> ' + d.iata_code AS Route,
    COUNT(DISTINCT CASE 
        WHEN cc.cabin_class_code = 'J' AND fs.is_available = 1 
        THEN fs.flight_seat_id 
        ELSE NULL 
    END) AS BusinessAvailableSeats,
    COUNT(DISTINCT CASE 
        WHEN cc.cabin_class_code = 'Y' AND fs.is_available = 1 
        THEN fs.flight_seat_id 
        ELSE NULL 
    END) AS EconomyAvailableSeats
FROM FlightInstances fi
INNER JOIN FlightSchedules fs_schedule ON fi.flight_schedule_id = fs_schedule.flight_schedule_id
INNER JOIN Routes r ON fs_schedule.route_id = r.route_id
INNER JOIN Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN Airports d ON r.destination_airport_id = d.airport_id
INNER JOIN FlightSeats fs ON fi.flight_instance_id = fs.flight_instance_id
INNER JOIN SeatConfigurations sc ON fs.seat_config_id = sc.seat_config_id
INNER JOIN CabinClasses cc ON sc.cabin_class_code = cc.cabin_class_code
WHERE fi.status IN ('scheduled', 'on_time', 'delayed')
  AND CAST(fi.flight_date AS DATE) >= @today
GROUP BY 
    fi.flight_instance_id,
    fi.flight_number,
    fi.flight_date,
    fi.departure_datetime_local,
    o.iata_code,
    d.iata_code
HAVING COUNT(DISTINCT CASE WHEN cc.cabin_class_code = 'J' AND fs.is_available = 1 THEN fs.flight_seat_id ELSE NULL END) >= @minSeats
ORDER BY fi.flight_date, fi.departure_datetime_local;

-- 3. Top 20 flight instances gần nhất (từ hôm nay) có business seats
SELECT TOP 20
    'Top 20 Nearest Flights (Business)' AS CheckType,
    fi.flight_instance_id AS FlightInstanceId,
    fi.flight_number,
    fi.flight_date,
    fi.departure_datetime_local,
    o.iata_code + ' -> ' + d.iata_code AS Route,
    COUNT(DISTINCT CASE 
        WHEN cc.cabin_class_code = 'J' AND fs.is_available = 1 
        THEN fs.flight_seat_id 
        ELSE NULL 
    END) AS BusinessSeats,
    COUNT(DISTINCT CASE 
        WHEN cc.cabin_class_code = 'Y' AND fs.is_available = 1 
        THEN fs.flight_seat_id 
        ELSE NULL 
    END) AS EconomySeats
FROM FlightInstances fi
INNER JOIN FlightSchedules fs_schedule ON fi.flight_schedule_id = fs_schedule.flight_schedule_id
INNER JOIN Routes r ON fs_schedule.route_id = r.route_id
INNER JOIN Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN Airports d ON r.destination_airport_id = d.airport_id
INNER JOIN FlightSeats fs ON fi.flight_instance_id = fs.flight_instance_id
INNER JOIN SeatConfigurations sc ON fs.seat_config_id = sc.seat_config_id
INNER JOIN CabinClasses cc ON sc.cabin_class_code = cc.cabin_class_code
WHERE fi.status IN ('scheduled', 'on_time', 'delayed')
  AND CAST(fi.flight_date AS DATE) >= @today
GROUP BY 
    fi.flight_instance_id,
    fi.flight_number,
    fi.flight_date,
    fi.departure_datetime_local,
    o.iata_code,
    d.iata_code
HAVING COUNT(DISTINCT CASE WHEN cc.cabin_class_code = 'J' AND fs.is_available = 1 THEN fs.flight_seat_id ELSE NULL END) >= @minSeats
ORDER BY fi.flight_date, fi.departure_datetime_local;

-- 4. Tìm flight instances có cả business và economy (để test cả 2 cabin types)
SELECT TOP 30
    fi.flight_instance_id AS FlightInstanceId,
    fi.flight_number,
    fi.flight_date,
    o.iata_code + ' -> ' + d.iata_code AS Route,
    COUNT(DISTINCT CASE 
        WHEN cc.cabin_class_code = 'Y' AND fs.is_available = 1 
        THEN fs.flight_seat_id 
        ELSE NULL 
    END) AS EconomyAvailableSeats,
    COUNT(DISTINCT CASE 
        WHEN cc.cabin_class_code = 'J' AND fs.is_available = 1 
        THEN fs.flight_seat_id 
        ELSE NULL 
    END) AS BusinessAvailableSeats,
    CASE 
        WHEN COUNT(DISTINCT CASE WHEN cc.cabin_class_code = 'Y' AND fs.is_available = 1 THEN fs.flight_seat_id ELSE NULL END) >= @minSeats 
             AND COUNT(DISTINCT CASE WHEN cc.cabin_class_code = 'J' AND fs.is_available = 1 THEN fs.flight_seat_id ELSE NULL END) >= @minSeats
        THEN 'Both'
        WHEN COUNT(DISTINCT CASE WHEN cc.cabin_class_code = 'J' AND fs.is_available = 1 THEN fs.flight_seat_id ELSE NULL END) >= @minSeats
        THEN 'Business Only'
        ELSE 'Economy Only'
    END AS AvailableCabins
FROM FlightInstances fi
INNER JOIN FlightSchedules fs_schedule ON fi.flight_schedule_id = fs_schedule.flight_schedule_id
INNER JOIN Routes r ON fs_schedule.route_id = r.route_id
INNER JOIN Airports o ON r.origin_airport_id = o.airport_id
INNER JOIN Airports d ON r.destination_airport_id = d.airport_id
INNER JOIN FlightSeats fs ON fi.flight_instance_id = fs.flight_instance_id
INNER JOIN SeatConfigurations sc ON fs.seat_config_id = sc.seat_config_id
INNER JOIN CabinClasses cc ON sc.cabin_class_code = cc.cabin_class_code
WHERE fi.status IN ('scheduled', 'on_time', 'delayed')
  AND CAST(fi.flight_date AS DATE) >= @today
GROUP BY 
    fi.flight_instance_id,
    fi.flight_number,
    fi.flight_date,
    fi.departure_datetime_local,
    o.iata_code,
    d.iata_code
HAVING COUNT(DISTINCT CASE WHEN cc.cabin_class_code = 'J' AND fs.is_available = 1 THEN fs.flight_seat_id ELSE NULL END) >= @minSeats
ORDER BY fi.flight_date, fi.departure_datetime_local;

