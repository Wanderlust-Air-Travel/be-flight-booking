-- ============================================================
-- TÌM CÁC FLIGHT INSTANCE ID HỢP LỆ CHO API FARE-OPTIONS
-- ============================================================

DECLARE @cabinType VARCHAR(10) = 'economy'; -- 'economy' hoặc 'business'
DECLARE @minSeats INT = 1;

-- Mapping cabin type to cabin class codes
-- Economy: 'Y'
-- Business: 'J'

-- 1. Tìm tất cả flight instances có seats available cho cabin type
SELECT 
    fi.flight_instance_id,
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
        WHEN sc.cabin_class_code = CASE 
            WHEN @cabinType = 'economy' THEN 'Y'
            WHEN @cabinType = 'business' THEN 'J'
            ELSE 'Y'
        END AND fs.is_available = 1 
        THEN fs.flight_seat_id 
        ELSE NULL 
    END) AS AvailableSeatsForCabin,
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
  AND cc.cabin_class_code = CASE 
        WHEN @cabinType = 'economy' THEN 'Y'
        WHEN @cabinType = 'business' THEN 'J'
        ELSE 'Y'
    END
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
    WHEN sc.cabin_class_code = CASE 
        WHEN @cabinType = 'economy' THEN 'Y'
        WHEN @cabinType = 'business' THEN 'J'
        ELSE 'Y'
    END AND fs.is_available = 1 
    THEN fs.flight_seat_id 
    ELSE NULL 
END) >= @minSeats
ORDER BY fi.flight_date, fi.departure_datetime_local;

-- 2. Tìm flight instances cho cả economy và business
SELECT 
    fi.flight_instance_id,
    fi.flight_number,
    fi.flight_date,
    fi.departure_datetime_local,
    o.iata_code AS OriginIATA,
    d.iata_code AS DestIATA,
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
        WHEN COUNT(DISTINCT CASE WHEN cc.cabin_class_code = 'Y' AND fs.is_available = 1 THEN fs.flight_seat_id ELSE NULL END) >= @minSeats
        THEN 'Economy Only'
        WHEN COUNT(DISTINCT CASE WHEN cc.cabin_class_code = 'J' AND fs.is_available = 1 THEN fs.flight_seat_id ELSE NULL END) >= @minSeats
        THEN 'Business Only'
        ELSE 'None'
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
GROUP BY 
    fi.flight_instance_id,
    fi.flight_number,
    fi.flight_date,
    fi.departure_datetime_local,
    o.iata_code,
    d.iata_code
HAVING COUNT(DISTINCT CASE WHEN cc.cabin_class_code = 'Y' AND fs.is_available = 1 THEN fs.flight_seat_id ELSE NULL END) >= @minSeats
    OR COUNT(DISTINCT CASE WHEN cc.cabin_class_code = 'J' AND fs.is_available = 1 THEN fs.flight_seat_id ELSE NULL END) >= @minSeats
ORDER BY fi.flight_date, fi.departure_datetime_local;

-- 3. Top 20 flight instances gần nhất (từ hôm nay) có cả economy và business
DECLARE @today DATE = CAST(GETDATE() AS DATE);

SELECT TOP 20
    'Top 20 Nearest Flights (Both Cabins)' AS CheckType,
    fi.flight_instance_id,
    fi.flight_number,
    fi.flight_date,
    fi.departure_datetime_local,
    o.iata_code + ' -> ' + d.iata_code AS Route,
    COUNT(DISTINCT CASE 
        WHEN cc.cabin_class_code = 'Y' AND fs.is_available = 1 
        THEN fs.flight_seat_id 
        ELSE NULL 
    END) AS EconomySeats,
    COUNT(DISTINCT CASE 
        WHEN cc.cabin_class_code = 'J' AND fs.is_available = 1 
        THEN fs.flight_seat_id 
        ELSE NULL 
    END) AS BusinessSeats
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
HAVING COUNT(DISTINCT CASE WHEN cc.cabin_class_code = 'Y' AND fs.is_available = 1 THEN fs.flight_seat_id ELSE NULL END) >= @minSeats
   AND COUNT(DISTINCT CASE WHEN cc.cabin_class_code = 'J' AND fs.is_available = 1 THEN fs.flight_seat_id ELSE NULL END) >= @minSeats
ORDER BY fi.flight_date, fi.departure_datetime_local;

-- 4. Query đơn giản: Chỉ lấy flightInstanceId và route (để copy vào Postman)
SELECT TOP 50
    fi.flight_instance_id AS FlightInstanceId,
    fi.flight_number,
    fi.flight_date,
    o.iata_code + ' -> ' + d.iata_code AS Route,
    COUNT(DISTINCT CASE 
        WHEN cc.cabin_class_code = 'Y' AND fs.is_available = 1 
        THEN fs.flight_seat_id 
        ELSE NULL 
    END) AS EconomySeats,
    COUNT(DISTINCT CASE 
        WHEN cc.cabin_class_code = 'J' AND fs.is_available = 1 
        THEN fs.flight_seat_id 
        ELSE NULL 
    END) AS BusinessSeats
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
HAVING COUNT(DISTINCT CASE WHEN cc.cabin_class_code = 'Y' AND fs.is_available = 1 THEN fs.flight_seat_id ELSE NULL END) >= @minSeats
    OR COUNT(DISTINCT CASE WHEN cc.cabin_class_code = 'J' AND fs.is_available = 1 THEN fs.flight_seat_id ELSE NULL END) >= @minSeats
ORDER BY fi.flight_date, fi.departure_datetime_local;

