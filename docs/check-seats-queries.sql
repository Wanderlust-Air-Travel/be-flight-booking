-- ============================================================
-- QUERIES KIỂM TRA SEATS ĐÃ ĐƯỢC GÁN CHO BOOKINGS
-- ============================================================

-- 1. Kiểm tra tổng số booking segments có seat được gán
SELECT COUNT(*) AS total_segments_with_seats
FROM booking_segment
WHERE flight_seat_id IS NOT NULL;

-- 2. Kiểm tra số ghế đã được đặt (is_available = 0)
SELECT 
    COUNT(*) AS booked_seats,
    (SELECT COUNT(*) FROM flight_seat) AS total_seats,
    CAST(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM flight_seat), 0) AS DECIMAL(5,2)) AS booked_percentage
FROM flight_seat
WHERE is_available = 0;

-- 3. Xem 10 booking segments mẫu với thông tin ghế
SELECT TOP 10
    bs.booking_segment_id,
    b.pnr_code,
    p.fullname AS passenger_name,
    fi.flight_number,
    fs.seat_number,
    fs.is_available,
    bs.status AS segment_status,
    b.status AS booking_status
FROM booking_segment bs
INNER JOIN booking b ON bs.booking_id = b.booking_id
INNER JOIN booking_passenger bp ON bs.booking_passenger_id = bp.booking_passenger_id
INNER JOIN passenger p ON bp.passenger_id = p.passenger_id
INNER JOIN flight_instance fi ON bs.flight_instance_id = fi.flight_instance_id
INNER JOIN flight_seat fs ON bs.flight_seat_id = fs.flight_seat_id
ORDER BY b.created_at DESC;

-- 4. Thống kê theo trạng thái booking
SELECT 
    b.status AS booking_status,
    COUNT(*) AS total_bookings,
    COUNT(bs.booking_segment_id) AS total_segments,
    COUNT(CASE WHEN bs.flight_seat_id IS NOT NULL THEN 1 END) AS segments_with_seats
FROM booking b
LEFT JOIN booking_segment bs ON b.booking_id = bs.booking_id
GROUP BY b.status;

-- 5. Kiểm tra booking segments KHÔNG có seat (nếu có)
SELECT 
    bs.booking_segment_id,
    b.pnr_code,
    fi.flight_number
FROM booking_segment bs
INNER JOIN booking b ON bs.booking_id = b.booking_id
INNER JOIN flight_instance fi ON bs.flight_instance_id = fi.flight_instance_id
WHERE bs.flight_seat_id IS NULL;

-- 6. Thống kê số ghế đã đặt theo flight instance
SELECT TOP 10
    fi.flight_number,
    fi.flight_date,
    COUNT(CASE WHEN fs.is_available = 0 THEN 1 END) AS booked_seats,
    COUNT(fs.flight_seat_id) AS total_seats,
    CAST(COUNT(CASE WHEN fs.is_available = 0 THEN 1 END) * 100.0 / NULLIF(COUNT(fs.flight_seat_id), 0) AS DECIMAL(5,2)) AS occupancy_rate
FROM flight_instance fi
LEFT JOIN flight_seat fs ON fi.flight_instance_id = fs.flight_instance_id
GROUP BY fi.flight_number, fi.flight_date
ORDER BY booked_seats DESC;

-- 7. Query tổng hợp nhanh
SELECT 
    (SELECT COUNT(*) FROM booking) AS total_bookings,
    (SELECT COUNT(*) FROM booking_segment) AS total_segments,
    (SELECT COUNT(*) FROM booking_segment WHERE flight_seat_id IS NOT NULL) AS segments_with_seats,
    (SELECT COUNT(*) FROM flight_seat WHERE is_available = 0) AS booked_seats,
    (SELECT COUNT(*) FROM flight_seat WHERE is_available = 1) AS available_seats;

