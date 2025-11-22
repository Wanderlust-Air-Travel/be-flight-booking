-- QUERY NGẮN NHẤT: Kiểm tra seats đã được gán chưa
SELECT 
    COUNT(*) AS segments_co_seats,
    (SELECT COUNT(*) FROM BookingSegments) AS total_segments
FROM BookingSegments 
WHERE flight_seat_id IS NOT NULL;

-- Kiểm tra số ghế đã đặt
SELECT COUNT(*) AS booked_seats FROM FlightSeats WHERE is_available = 0;

-- Xem mẫu 5 booking có seat
SELECT TOP 5 b.pnr_code, bs.flight_seat_id, fs.seat_number, fs.is_available
FROM BookingSegments bs
JOIN Bookings b ON bs.booking_id = b.booking_id
JOIN FlightSeats fs ON bs.flight_seat_id = fs.flight_seat_id;

