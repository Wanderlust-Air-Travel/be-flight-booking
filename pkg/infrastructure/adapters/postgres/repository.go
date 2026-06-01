package postgres

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"flight-booking/pkg/application/ports"
	"flight-booking/pkg/domain/entities"
	"flight-booking/pkg/domain/entities/booking"
	"flight-booking/pkg/domain/entities/flight"
	apperrors "flight-booking/pkg/shared/errors"
	"flight-booking/pkg/shared/logger"
)

// Pool wraps pgxpool.Pool with additional functionality.
type Pool struct {
	*pgxpool.Pool
	log *logger.Logger
}

// NewPool creates a new PostgreSQL connection pool.
func NewPool(ctx context.Context, dsn string, log *logger.Logger) (*Pool, error) {
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database config: %w", err)
	}

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Info("PostgreSQL connection pool established", logger.Fields{
		"max_conns": config.MaxConns,
		"min_conns": config.MinConns,
	})

	return &Pool{Pool: pool, log: log}, nil
}

// Close closes the connection pool.
func (p *Pool) Close() {
	p.Pool.Close()
	p.log.Info("PostgreSQL connection pool closed", nil)
}

// ============================================================================
// Airport Repository
// ============================================================================

// AirportRepository handles airport data persistence.
type AirportRepository struct {
	pool *Pool
}

// NewAirportRepository creates a new AirportRepository.
func NewAirportRepository(pool *Pool) *AirportRepository {
	return &AirportRepository{pool: pool}
}

// FindByIATA retrieves an airport by its IATA code.
func (r *AirportRepository) FindByIATA(ctx context.Context, iata string) (*flight.Airport, error) {
	query := `
		SELECT iata_code, name, city, country, country_code, latitude, longitude, timezone, altitude
		FROM airports
		WHERE iata_code = $1
	`

	var airport flight.Airport
	err := r.pool.QueryRow(ctx, query, strings.ToUpper(iata)).Scan(
		&airport.IATACode,
		&airport.Name,
		&airport.City,
		&airport.Country,
		&airport.CountryCode,
		&airport.Latitude,
		&airport.Longitude,
		&airport.Timezone,
		&airport.Altitude,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, apperrors.NotFound(fmt.Sprintf("airport with IATA code %s not found", iata))
		}
		return nil, apperrors.Internal(fmt.Sprintf("failed to find airport: %v", err))
	}

	return &airport, nil
}

// FindAll retrieves all airports.
func (r *AirportRepository) FindAll(ctx context.Context) ([]flight.Airport, error) {
	query := `
		SELECT iata_code, name, city, country, country_code, latitude, longitude, timezone, altitude
		FROM airports
		ORDER BY iata_code
	`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, apperrors.Internal(fmt.Sprintf("failed to query airports: %v", err))
	}
	defer rows.Close()

	var airports []flight.Airport
	for rows.Next() {
		var airport flight.Airport
		err := rows.Scan(
			&airport.IATACode,
			&airport.Name,
			&airport.City,
			&airport.Country,
			&airport.CountryCode,
			&airport.Latitude,
			&airport.Longitude,
			&airport.Timezone,
			&airport.Altitude,
		)
		if err != nil {
			return nil, apperrors.Internal(fmt.Sprintf("failed to scan airport: %v", err))
		}
		airports = append(airports, airport)
	}

	if err := rows.Err(); err != nil {
		return nil, apperrors.Internal(fmt.Sprintf("error iterating airports: %v", err))
	}

	return airports, nil
}

// Search searches airports by name, city, or IATA code.
func (r *AirportRepository) Search(ctx context.Context, q string) ([]flight.Airport, error) {
	searchPattern := "%" + strings.ToUpper(q) + "%"
	query := `
		SELECT iata_code, name, city, country, country_code, latitude, longitude, timezone, altitude
		FROM airports
		WHERE UPPER(iata_code) LIKE $1
		   OR UPPER(name) LIKE $1
		   OR UPPER(city) LIKE $1
		ORDER BY iata_code
		LIMIT 50
	`

	rows, err := r.pool.Query(ctx, query, searchPattern)
	if err != nil {
		return nil, apperrors.Internal(fmt.Sprintf("failed to search airports: %v", err))
	}
	defer rows.Close()

	var airports []flight.Airport
	for rows.Next() {
		var airport flight.Airport
		err := rows.Scan(
			&airport.IATACode,
			&airport.Name,
			&airport.City,
			&airport.Country,
			&airport.CountryCode,
			&airport.Latitude,
			&airport.Longitude,
			&airport.Timezone,
			&airport.Altitude,
		)
		if err != nil {
			return nil, apperrors.Internal(fmt.Sprintf("failed to scan airport: %v", err))
		}
		airports = append(airports, airport)
	}

	return airports, nil
}

// Save persists an airport (insert or update on conflict).
func (r *AirportRepository) Save(ctx context.Context, airport *flight.Airport) error {
	query := `
		INSERT INTO airports (iata_code, name, city, country, country_code, latitude, longitude, timezone, altitude)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (iata_code) DO UPDATE SET
			name = EXCLUDED.name,
			city = EXCLUDED.city,
			country = EXCLUDED.country,
			country_code = EXCLUDED.country_code,
			latitude = EXCLUDED.latitude,
			longitude = EXCLUDED.longitude,
			timezone = EXCLUDED.timezone,
			altitude = EXCLUDED.altitude
	`

	_, err := r.pool.Exec(ctx, query,
		airport.IATACode,
		airport.Name,
		airport.City,
		airport.Country,
		airport.CountryCode,
		airport.Latitude,
		airport.Longitude,
		airport.Timezone,
		airport.Altitude,
	)

	if err != nil {
		return apperrors.Internal(fmt.Sprintf("failed to save airport: %v", err))
	}

	return nil
}

// Ensure AirportRepository implements ports.AirportRepositoryPort
var _ ports.AirportRepositoryPort = (*AirportRepository)(nil)

// ============================================================================
// Flight Repository
// ============================================================================

// FlightRepository handles flight data persistence.
type FlightRepository struct {
	pool *Pool
}

// NewFlightRepository creates a new FlightRepository.
func NewFlightRepository(pool *Pool) *FlightRepository {
	return &FlightRepository{pool: pool}
}

// FindByID retrieves a flight instance by its unique identifier.
func (r *FlightRepository) FindByID(ctx context.Context, id uuid.UUID) (*flight.FlightInstance, error) {
	query := `
		SELECT id, flight_number, route_id, airline_code, origin_code, destination_code,
		       scheduled_departure, scheduled_arrival, actual_departure, actual_arrival,
		       departure_terminal, arrival_terminal, aircraft_type, available_seats, total_seats,
		       status, cabin_class, gate, created_at, updated_at
		FROM flight_instances
		WHERE id = $1
	`

	var fl flight.FlightInstance
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&fl.ID,
		&fl.FlightNumber,
		&fl.RouteID,
		&fl.AirlineCode,
		&fl.OriginCode,
		&fl.DestinationCode,
		&fl.ScheduledDeparture,
		&fl.ScheduledArrival,
		&fl.ActualDeparture,
		&fl.ActualArrival,
		&fl.DepartureTerminal,
		&fl.ArrivalTerminal,
		&fl.AircraftType,
		&fl.AvailableSeats,
		&fl.TotalSeats,
		&fl.Status,
		&fl.CabinClass,
		&fl.Gate,
		&fl.CreatedAt,
		&fl.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, apperrors.NotFound(fmt.Sprintf("flight with ID %s not found", id))
		}
		return nil, apperrors.Internal(fmt.Sprintf("failed to find flight: %v", err))
	}

	return &fl, nil
}

// FindByNumberAndDate retrieves a flight by flight number and date.
func (r *FlightRepository) FindByNumberAndDate(ctx context.Context, number string, date time.Time) (*flight.FlightInstance, error) {
	startOfDay := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.UTC)
	endOfDay := startOfDay.Add(24 * time.Hour)

	query := `
		SELECT id, flight_number, route_id, airline_code, origin_code, destination_code,
		       scheduled_departure, scheduled_arrival, actual_departure, actual_arrival,
		       departure_terminal, arrival_terminal, aircraft_type, available_seats, total_seats,
		       status, cabin_class, gate, created_at, updated_at
		FROM flight_instances
		WHERE flight_number = $1
		  AND scheduled_departure >= $2
		  AND scheduled_departure < $3
	`

	var fl flight.FlightInstance
	err := r.pool.QueryRow(ctx, query, number, startOfDay, endOfDay).Scan(
		&fl.ID,
		&fl.FlightNumber,
		&fl.RouteID,
		&fl.AirlineCode,
		&fl.OriginCode,
		&fl.DestinationCode,
		&fl.ScheduledDeparture,
		&fl.ScheduledArrival,
		&fl.ActualDeparture,
		&fl.ActualArrival,
		&fl.DepartureTerminal,
		&fl.ArrivalTerminal,
		&fl.AircraftType,
		&fl.AvailableSeats,
		&fl.TotalSeats,
		&fl.Status,
		&fl.CabinClass,
		&fl.Gate,
		&fl.CreatedAt,
		&fl.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, apperrors.NotFound(fmt.Sprintf("flight %s on %s not found", number, date.Format("2006-01-02")))
		}
		return nil, apperrors.Internal(fmt.Sprintf("failed to find flight: %v", err))
	}

	return &fl, nil
}

// SearchAvailable searches for available flights matching the criteria.
func (r *FlightRepository) SearchAvailable(ctx context.Context, req ports.SearchFlightRequest) ([]flight.FlightInstance, error) {
	var args []interface{}
	argIndex := 1

	query := `
		SELECT id, flight_number, route_id, airline_code, origin_code, destination_code,
		       scheduled_departure, scheduled_arrival, actual_departure, actual_arrival,
		       departure_terminal, arrival_terminal, aircraft_type, available_seats, total_seats,
		       status, cabin_class, gate, created_at, updated_at
		FROM flight_instances
		WHERE status NOT IN ('CANCELLED', 'ARRIVED')
		  AND available_seats > 0
	`

	if req.Origin != "" {
		query += fmt.Sprintf(" AND origin_code = $%d", argIndex)
		args = append(args, req.Origin)
		argIndex++
	}

	if req.Destination != "" {
		query += fmt.Sprintf(" AND destination_code = $%d", argIndex)
		args = append(args, req.Destination)
		argIndex++
	}

	if req.DepartureDate != "" {
		depDate, err := time.Parse("2006-01-02", req.DepartureDate)
		if err == nil {
			startOfDay := time.Date(depDate.Year(), depDate.Month(), depDate.Day(), 0, 0, 0, 0, time.UTC)
			endOfDay := startOfDay.Add(24 * time.Hour)
			query += fmt.Sprintf(" AND scheduled_departure >= $%d AND scheduled_departure < $%d", argIndex, argIndex+1)
			args = append(args, startOfDay, endOfDay)
			argIndex += 2
		}
	}

	if req.Passengers > 0 {
		query += fmt.Sprintf(" AND available_seats >= $%d", argIndex)
		args = append(args, req.Passengers)
		argIndex++
	}

	query += " ORDER BY scheduled_departure"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, apperrors.Internal(fmt.Sprintf("failed to search flights: %v", err))
	}
	defer rows.Close()

	var flights []flight.FlightInstance
	for rows.Next() {
		var fl flight.FlightInstance
		err := rows.Scan(
			&fl.ID,
			&fl.FlightNumber,
			&fl.RouteID,
			&fl.AirlineCode,
			&fl.OriginCode,
			&fl.DestinationCode,
			&fl.ScheduledDeparture,
			&fl.ScheduledArrival,
			&fl.ActualDeparture,
			&fl.ActualArrival,
			&fl.DepartureTerminal,
			&fl.ArrivalTerminal,
			&fl.AircraftType,
			&fl.AvailableSeats,
			&fl.TotalSeats,
			&fl.Status,
			&fl.CabinClass,
			&fl.Gate,
			&fl.CreatedAt,
			&fl.UpdatedAt,
		)
		if err != nil {
			return nil, apperrors.Internal(fmt.Sprintf("failed to scan flight: %v", err))
		}
		flights = append(flights, fl)
	}

	return flights, nil
}

// Save persists a flight instance (insert or update on conflict).
func (r *FlightRepository) Save(ctx context.Context, fl *flight.FlightInstance) error {
	query := `
		INSERT INTO flight_instances (
			id, flight_number, route_id, airline_code, origin_code, destination_code,
			scheduled_departure, scheduled_arrival, actual_departure, actual_arrival,
			departure_terminal, arrival_terminal, aircraft_type, available_seats, total_seats,
			status, cabin_class, gate, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
		)
		ON CONFLICT (id) DO UPDATE SET
			flight_number = EXCLUDED.flight_number,
			route_id = EXCLUDED.route_id,
			airline_code = EXCLUDED.airline_code,
			origin_code = EXCLUDED.origin_code,
			destination_code = EXCLUDED.destination_code,
			scheduled_departure = EXCLUDED.scheduled_departure,
			scheduled_arrival = EXCLUDED.scheduled_arrival,
			actual_departure = EXCLUDED.actual_departure,
			actual_arrival = EXCLUDED.actual_arrival,
			departure_terminal = EXCLUDED.departure_terminal,
			arrival_terminal = EXCLUDED.arrival_terminal,
			aircraft_type = EXCLUDED.aircraft_type,
			available_seats = EXCLUDED.available_seats,
			total_seats = EXCLUDED.total_seats,
			status = EXCLUDED.status,
			cabin_class = EXCLUDED.cabin_class,
			gate = EXCLUDED.gate,
			updated_at = EXCLUDED.updated_at
	`

	_, err := r.pool.Exec(ctx, query,
		fl.ID,
		fl.FlightNumber,
		fl.RouteID,
		fl.AirlineCode,
		fl.OriginCode,
		fl.DestinationCode,
		fl.ScheduledDeparture,
		fl.ScheduledArrival,
		fl.ActualDeparture,
		fl.ActualArrival,
		fl.DepartureTerminal,
		fl.ArrivalTerminal,
		fl.AircraftType,
		fl.AvailableSeats,
		fl.TotalSeats,
		fl.Status,
		fl.CabinClass,
		fl.Gate,
		fl.CreatedAt,
		fl.UpdatedAt,
	)

	if err != nil {
		return apperrors.Internal(fmt.Sprintf("failed to save flight: %v", err))
	}

	return nil
}

// UpdateStatus updates the status of a flight.
func (r *FlightRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status flight.FlightStatus) error {
	query := `
		UPDATE flight_instances
		SET status = $1, updated_at = $2
		WHERE id = $3
	`

	result, err := r.pool.Exec(ctx, query, status, time.Now(), id)
	if err != nil {
		return apperrors.Internal(fmt.Sprintf("failed to update flight status: %v", err))
	}

	if result.RowsAffected() == 0 {
		return apperrors.NotFound(fmt.Sprintf("flight with ID %s not found", id))
	}

	return nil
}

// UpdateAvailability updates seat availability atomically with check >= 0.
func (r *FlightRepository) UpdateAvailability(ctx context.Context, id uuid.UUID, delta int) error {
	query := `
		UPDATE flight_instances
		SET available_seats = available_seats + $1, updated_at = $2
		WHERE id = $3 AND available_seats + $1 >= 0
	`

	result, err := r.pool.Exec(ctx, query, delta, time.Now(), id)
	if err != nil {
		return apperrors.Internal(fmt.Sprintf("failed to update availability: %v", err))
	}

	if result.RowsAffected() == 0 {
		return apperrors.SeatUnavailable("insufficient seats available")
	}

	return nil
}

// FindSchedules retrieves flight schedules for a route.
func (r *FlightRepository) FindSchedules(ctx context.Context, origin, dest, airline string) ([]flight.FlightSchedule, error) {
	var args []interface{}
	argIndex := 1

	query := `
		SELECT id, flight_number, airline_code, origin_code, destination_code,
		       departure_time, arrival_time, duration_minutes, aircraft_type,
		       operating_days, effective_from, effective_to, created_at, updated_at
		FROM flight_schedules
		WHERE origin_code = $1 AND destination_code = $2 AND active = true
	`

	args = append(args, origin, dest)
	argIndex += 2

	if airline != "" {
		query += fmt.Sprintf(" AND airline_code = $%d", argIndex)
		args = append(args, airline)
	}

	query += " ORDER BY departure_time"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, apperrors.Internal(fmt.Sprintf("failed to find schedules: %v", err))
	}
	defer rows.Close()

	var schedules []flight.FlightSchedule
	for rows.Next() {
		var schedule flight.FlightSchedule
		err := rows.Scan(
			&schedule.ID,
			&schedule.FlightNumber,
			&schedule.AirlineCode,
			&schedule.OriginCode,
			&schedule.DestinationCode,
			&schedule.DepartureTime,
			&schedule.ArrivalTime,
			&schedule.DurationMinutes,
			&schedule.AircraftType,
			&schedule.OperatingDays,
			&schedule.EffectiveFrom,
			&schedule.EffectiveTo,
			&schedule.CreatedAt,
			&schedule.UpdatedAt,
		)
		if err != nil {
			return nil, apperrors.Internal(fmt.Sprintf("failed to scan schedule: %v", err))
		}
		schedules = append(schedules, schedule)
	}

	return schedules, nil
}

// FindRoute retrieves route information between two airports.
func (r *FlightRepository) FindRoute(ctx context.Context, origin, dest, airline string) (*flight.Route, error) {
	var args []interface{}
	argIndex := 1

	query := `
		SELECT id, origin_code, destination_code, airline_code, distance_km,
		       avg_duration_min, active
		FROM routes
		WHERE origin_code = $1 AND destination_code = $2 AND active = true
	`

	args = append(args, origin, dest)
	argIndex += 2

	if airline != "" {
		query += fmt.Sprintf(" AND airline_code = $%d", argIndex)
		args = append(args, airline)
	}

	query += " LIMIT 1"

	var route flight.Route
	err := r.pool.QueryRow(ctx, query, args...).Scan(
		&route.ID,
		&route.OriginCode,
		&route.DestinationCode,
		&route.AirlineCode,
		&route.DistanceKm,
		&route.AvgDurationMin,
		&route.Active,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, apperrors.NotFound(fmt.Sprintf("route %s-%s not found", origin, dest))
		}
		return nil, apperrors.Internal(fmt.Sprintf("failed to find route: %v", err))
	}

	return &route, nil
}

// Ensure FlightRepository implements ports.FlightRepositoryPort
var _ ports.FlightRepositoryPort = (*FlightRepository)(nil)

// ============================================================================
// Booking Repository
// ============================================================================

// BookingRepository handles booking data persistence.
type BookingRepository struct {
	pool *Pool
}

// NewBookingRepository creates a new BookingRepository.
func NewBookingRepository(pool *Pool) *BookingRepository {
	return &BookingRepository{pool: pool}
}

// FindByID retrieves a booking by its unique identifier.
func (r *BookingRepository) FindByID(ctx context.Context, id uuid.UUID) (*booking.Booking, error) {
	query := `
		SELECT id, booking_code, user_id, contact_email, contact_phone, contact_name,
		       status, total_amount_vnd, currency, payment_deadline, payment_method,
		       ticketed_at, cancelled_at, cancelled_by, cancel_reason, agent_id,
		       ip_address, user_agent, created_at, updated_at
		FROM bookings
		WHERE id = $1
	`

	b, err := r.findOne(ctx, query, id)
	if err != nil {
		return nil, err
	}

	return b, nil
}

// FindByCode retrieves a booking by its booking code.
func (r *BookingRepository) FindByCode(ctx context.Context, code string) (*booking.Booking, error) {
	query := `
		SELECT id, booking_code, user_id, contact_email, contact_phone, contact_name,
		       status, total_amount_vnd, currency, payment_deadline, payment_method,
		       ticketed_at, cancelled_at, cancelled_by, cancel_reason, agent_id,
		       ip_address, user_agent, created_at, updated_at
		FROM bookings
		WHERE booking_code = $1
	`

	b, err := r.findOne(ctx, query, code)
	if err != nil {
		return nil, err
	}

	return b, nil
}

// findOne is a private helper to execute a query and scan a single booking.
func (r *BookingRepository) findOne(ctx context.Context, query string, arg interface{}) (*booking.Booking, error) {
	var b booking.Booking
	var userID, agentID *uuid.UUID
	var paymentDeadline, ticketedAt, cancelledAt *time.Time
	var cancelledBy, cancelReason string

	err := r.pool.QueryRow(ctx, query, arg).Scan(
		&b.ID,
		&b.BookingCode,
		&userID,
		&b.ContactEmail,
		&b.ContactPhone,
		&b.ContactName,
		&b.Status,
		&b.TotalAmountVND,
		&b.Currency,
		&paymentDeadline,
		&b.PaymentMethod,
		&ticketedAt,
		&cancelledAt,
		&cancelledBy,
		&cancelReason,
		&agentID,
		&b.IPAddress,
		&b.UserAgent,
		&b.CreatedAt,
		&b.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, apperrors.NotFound("booking not found")
		}
		return nil, apperrors.Internal(fmt.Sprintf("failed to find booking: %v", err))
	}

	b.UserID = userID
	b.PaymentDeadline = paymentDeadline
	b.TicketedAt = ticketedAt
	b.CancelledAt = cancelledAt
	b.CancelledBy = cancelledBy
	b.CancelReason = cancelReason
	b.AgentID = agentID

	return &b, nil
}

// FindByUser retrieves bookings for a specific user with pagination.
func (r *BookingRepository) FindByUser(ctx context.Context, userID uuid.UUID, page, pageSize int) ([]booking.Booking, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	offset := (page - 1) * pageSize

	countQuery := `SELECT COUNT(*) FROM bookings WHERE user_id = $1`
	var total int
	err := r.pool.QueryRow(ctx, countQuery, userID).Scan(&total)
	if err != nil {
		return nil, 0, apperrors.Internal(fmt.Sprintf("failed to count bookings: %v", err))
	}

	query := `
		SELECT id, booking_code, user_id, contact_email, contact_phone, contact_name,
		       status, total_amount_vnd, currency, payment_deadline, payment_method,
		       ticketed_at, cancelled_at, cancelled_by, cancel_reason, agent_id,
		       ip_address, user_agent, created_at, updated_at
		FROM bookings
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.pool.Query(ctx, query, userID, pageSize, offset)
	if err != nil {
		return nil, 0, apperrors.Internal(fmt.Sprintf("failed to find bookings: %v", err))
	}
	defer rows.Close()

	var bookings []booking.Booking
	for rows.Next() {
		var b booking.Booking
		var uid, aid *uuid.UUID
		var pd, ta, ca *time.Time
		var cb, cr string

		err := rows.Scan(
			&b.ID,
			&b.BookingCode,
			&uid,
			&b.ContactEmail,
			&b.ContactPhone,
			&b.ContactName,
			&b.Status,
			&b.TotalAmountVND,
			&b.Currency,
			&pd,
			&b.PaymentMethod,
			&ta,
			&ca,
			&cb,
			&cr,
			&aid,
			&b.IPAddress,
			&b.UserAgent,
			&b.CreatedAt,
			&b.UpdatedAt,
		)
		if err != nil {
			return nil, 0, apperrors.Internal(fmt.Sprintf("failed to scan booking: %v", err))
		}

		b.UserID = uid
		b.PaymentDeadline = pd
		b.TicketedAt = ta
		b.CancelledAt = ca
		b.CancelledBy = cb
		b.CancelReason = cr
		b.AgentID = aid

		bookings = append(bookings, b)
	}

	return bookings, total, nil
}

// Save persists a booking (insert or update on conflict).
func (r *BookingRepository) Save(ctx context.Context, b *booking.Booking) error {
	query := `
		INSERT INTO bookings (
			id, booking_code, user_id, contact_email, contact_phone, contact_name,
			status, total_amount_vnd, currency, payment_deadline, payment_method,
			ticketed_at, cancelled_at, cancelled_by, cancel_reason, agent_id,
			ip_address, user_agent, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
		)
		ON CONFLICT (booking_code) DO UPDATE SET
			user_id = EXCLUDED.user_id,
			contact_email = EXCLUDED.contact_email,
			contact_phone = EXCLUDED.contact_phone,
			contact_name = EXCLUDED.contact_name,
			status = EXCLUDED.status,
			total_amount_vnd = EXCLUDED.total_amount_vnd,
			currency = EXCLUDED.currency,
			payment_deadline = EXCLUDED.payment_deadline,
			payment_method = EXCLUDED.payment_method,
			ticketed_at = EXCLUDED.ticketed_at,
			cancelled_at = EXCLUDED.cancelled_at,
			cancelled_by = EXCLUDED.cancelled_by,
			cancel_reason = EXCLUDED.cancel_reason,
			agent_id = EXCLUDED.agent_id,
			ip_address = EXCLUDED.ip_address,
			user_agent = EXCLUDED.user_agent,
			updated_at = EXCLUDED.updated_at
	`

	_, err := r.pool.Exec(ctx, query,
		b.ID,
		b.BookingCode,
		b.UserID,
		b.ContactEmail,
		b.ContactPhone,
		b.ContactName,
		b.Status,
		b.TotalAmountVND,
		b.Currency,
		b.PaymentDeadline,
		b.PaymentMethod,
		b.TicketedAt,
		b.CancelledAt,
		b.CancelledBy,
		b.CancelReason,
		b.AgentID,
		b.IPAddress,
		b.UserAgent,
		b.CreatedAt,
		b.UpdatedAt,
	)

	if err != nil {
		return apperrors.Internal(fmt.Sprintf("failed to save booking: %v", err))
	}

	return nil
}

// UpdateStatus updates the status of a booking.
func (r *BookingRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status booking.BookingStatus) error {
	query := `
		UPDATE bookings
		SET status = $1, updated_at = $2
		WHERE id = $3
	`

	result, err := r.pool.Exec(ctx, query, status, time.Now(), id)
	if err != nil {
		return apperrors.Internal(fmt.Sprintf("failed to update booking status: %v", err))
	}

	if result.RowsAffected() == 0 {
		return apperrors.NotFound(fmt.Sprintf("booking with ID %s not found", id))
	}

	return nil
}

// SavePassengers saves passenger information for a booking (batch insert).
func (r *BookingRepository) SavePassengers(ctx context.Context, passengers []booking.BookingPassenger) error {
	if len(passengers) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	for i, p := range passengers {
		offset := i * 11
		batch.Queue(`
			INSERT INTO passengers (id, booking_id, title, first_name, last_name, gender,
				date_of_birth, nationality, passport_number, passport_expiry, email, phone, type,
				created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
			ON CONFLICT (id) DO UPDATE SET
				title = EXCLUDED.title,
				first_name = EXCLUDED.first_name,
				last_name = EXCLUDED.last_name,
				gender = EXCLUDED.gender,
				date_of_birth = EXCLUDED.date_of_birth,
				nationality = EXCLUDED.nationality,
				passport_number = EXCLUDED.passport_number,
				passport_expiry = EXCLUDED.passport_expiry,
				email = EXCLUDED.email,
				phone = EXCLUDED.phone,
				type = EXCLUDED.type,
				updated_at = EXCLUDED.updated_at
		`,
			p.ID,
			p.BookingID,
			p.PassengerID.String(), // Will be updated with actual passenger ID
			"", // Title
			"", // FirstName
			"", // LastName
			p.Gender,
			time.Time{}, // DateOfBirth
			"", // Nationality
			"", // PassportNumber
			nil, // PassportExpiry
			"", // Email
			"", // Phone
			p.PassengerID,
			time.Now(),
			time.Now(),
		)
	}

	br := r.pool.SendBatch(ctx, batch)
	defer br.Close()

	for i := 0; i < len(passengers); i++ {
		_, err := br.Exec()
		if err != nil {
			return apperrors.Internal(fmt.Sprintf("failed to save passenger %d: %v", i, err))
		}
	}

	return nil
}

// SaveFlights saves flight segments for a booking (batch insert).
func (r *BookingRepository) SaveFlights(ctx context.Context, flights []booking.BookingFlight) error {
	if len(flights) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	for i, f := range flights {
		offset := i * 7
		batch.Queue(`
			INSERT INTO booking_flights (id, booking_id, flight_instance_id, leg_order,
				fare_vnd, tax_vnd, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT (id) DO UPDATE SET
				leg_order = EXCLUDED.leg_order,
				fare_vnd = EXCLUDED.fare_vnd,
				tax_vnd = EXCLUDED.tax_vnd,
				updated_at = EXCLUDED.updated_at
		`,
			f.ID,
			f.BookingID,
			f.FlightInstanceID,
			f.LegOrder,
			f.FareVND,
			f.TaxVND,
			f.CreatedAt,
			f.UpdatedAt,
		)
	}

	br := r.pool.SendBatch(ctx, batch)
	defer br.Close()

	for i := 0; i < len(flights); i++ {
		_, err := br.Exec()
		if err != nil {
			return apperrors.Internal(fmt.Sprintf("failed to save booking flight %d: %v", i, err))
		}
	}

	return nil
}

// WithTx executes a function within a database transaction.
func (r *BookingRepository) WithTx(ctx context.Context, fn func(ctx context.Context) error) error {
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{
		IsoLevel: pgx.Serializable,
	})
	if err != nil {
		return apperrors.Internal(fmt.Sprintf("failed to begin transaction: %v", err))
	}

	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback(ctx)
			panic(p)
		}
	}()

	txRepo := &txBookingRepo{tx: tx}

	if err := fn(withTxContext(ctx, txRepo)); err != nil {
		rbErr := tx.Rollback(ctx)
		if rbErr != nil {
			return apperrors.Internal(fmt.Sprintf("transaction failed and rollback failed: %v (original: %v)", rbErr, err))
		}
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return apperrors.Internal(fmt.Sprintf("failed to commit transaction: %v", err))
	}

	return nil
}

// txBookingRepo wraps pgx.Tx for transaction-scoped booking operations.
type txBookingRepo struct {
	tx pgx.Tx
}

// Ensure txBookingRepo implements BookingRepositoryPort
var _ ports.BookingRepositoryPort = (*txBookingRepo)(nil)

func (r *txBookingRepo) FindByID(ctx context.Context, id uuid.UUID) (*booking.Booking, error) {
	query := `
		SELECT id, booking_code, user_id, contact_email, contact_phone, contact_name,
		       status, total_amount_vnd, currency, payment_deadline, payment_method,
		       ticketed_at, cancelled_at, cancelled_by, cancel_reason, agent_id,
		       ip_address, user_agent, created_at, updated_at
		FROM bookings
		WHERE id = $1
	`

	var b booking.Booking
	var userID, agentID *uuid.UUID
	var pd, ta, ca *time.Time
	var cb, cr string

	err := r.tx.QueryRow(ctx, query, id).Scan(
		&b.ID,
		&b.BookingCode,
		&userID,
		&b.ContactEmail,
		&b.ContactPhone,
		&b.ContactName,
		&b.Status,
		&b.TotalAmountVND,
		&b.Currency,
		&pd,
		&b.PaymentMethod,
		&ta,
		&ca,
		&cb,
		&cr,
		&agentID,
		&b.IPAddress,
		&b.UserAgent,
		&b.CreatedAt,
		&b.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, apperrors.NotFound("booking not found")
		}
		return nil, apperrors.Internal(fmt.Sprintf("failed to find booking: %v", err))
	}

	b.UserID = userID
	b.PaymentDeadline = pd
	b.TicketedAt = ta
	b.CancelledAt = ca
	b.CancelledBy = cb
	b.CancelReason = cr
	b.AgentID = agentID

	return &b, nil
}

func (r *txBookingRepo) FindByCode(ctx context.Context, code string) (*booking.Booking, error) {
	query := `
		SELECT id, booking_code, user_id, contact_email, contact_phone, contact_name,
		       status, total_amount_vnd, currency, payment_deadline, payment_method,
		       ticketed_at, cancelled_at, cancelled_by, cancel_reason, agent_id,
		       ip_address, user_agent, created_at, updated_at
		FROM bookings
		WHERE booking_code = $1
	`

	var b booking.Booking
	var userID, agentID *uuid.UUID
	var pd, ta, ca *time.Time
	var cb, cr string

	err := r.tx.QueryRow(ctx, query, code).Scan(
		&b.ID,
		&b.BookingCode,
		&userID,
		&b.ContactEmail,
		&b.ContactPhone,
		&b.ContactName,
		&b.Status,
		&b.TotalAmountVND,
		&b.Currency,
		&pd,
		&b.PaymentMethod,
		&ta,
		&ca,
		&cb,
		&cr,
		&agentID,
		&b.IPAddress,
		&b.UserAgent,
		&b.CreatedAt,
		&b.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, apperrors.NotFound("booking not found")
		}
		return nil, apperrors.Internal(fmt.Sprintf("failed to find booking: %v", err))
	}

	b.UserID = userID
	b.PaymentDeadline = pd
	b.TicketedAt = ta
	b.CancelledAt = ca
	b.CancelledBy = cb
	b.CancelReason = cr
	b.AgentID = agentID

	return &b, nil
}

func (r *txBookingRepo) FindByUser(ctx context.Context, userID uuid.UUID, page, pageSize int) ([]booking.Booking, int, error) {
	return nil, 0, apperrors.Internal("FindByUser not supported in transaction context")
}

func (r *txBookingRepo) Save(ctx context.Context, b *booking.Booking) error {
	query := `
		INSERT INTO bookings (
			id, booking_code, user_id, contact_email, contact_phone, contact_name,
			status, total_amount_vnd, currency, payment_deadline, payment_method,
			ticketed_at, cancelled_at, cancelled_by, cancel_reason, agent_id,
			ip_address, user_agent, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
		)
		ON CONFLICT (booking_code) DO UPDATE SET
			status = EXCLUDED.status,
			total_amount_vnd = EXCLUDED.total_amount_vnd,
			updated_at = EXCLUDED.updated_at
	`

	_, err := r.tx.Exec(ctx, query,
		b.ID,
		b.BookingCode,
		b.UserID,
		b.ContactEmail,
		b.ContactPhone,
		b.ContactName,
		b.Status,
		b.TotalAmountVND,
		b.Currency,
		b.PaymentDeadline,
		b.PaymentMethod,
		b.TicketedAt,
		b.CancelledAt,
		b.CancelledBy,
		b.CancelReason,
		b.AgentID,
		b.IPAddress,
		b.UserAgent,
		b.CreatedAt,
		b.UpdatedAt,
	)

	if err != nil {
		return apperrors.Internal(fmt.Sprintf("failed to save booking: %v", err))
	}

	return nil
}

func (r *txBookingRepo) UpdateStatus(ctx context.Context, id uuid.UUID, status booking.BookingStatus) error {
	query := `UPDATE bookings SET status = $1, updated_at = $2 WHERE id = $3`
	_, err := r.tx.Exec(ctx, query, status, time.Now(), id)
	if err != nil {
		return apperrors.Internal(fmt.Sprintf("failed to update booking status: %v", err))
	}
	return nil
}

func (r *txBookingRepo) SavePassengers(ctx context.Context, passengers []booking.BookingPassenger) error {
	if len(passengers) == 0 {
		return nil
	}

	for _, p := range passengers {
		query := `
			INSERT INTO booking_passengers (id, booking_id, passenger_id, seat_id, ticket_number,
				fare_vnd, tax_vnd, insurance_vnd, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			ON CONFLICT (id) DO UPDATE SET
				seat_id = EXCLUDED.seat_id,
				ticket_number = EXCLUDED.ticket_number,
				updated_at = EXCLUDED.updated_at
		`
		_, err := r.tx.Exec(ctx, query,
			p.ID,
			p.BookingID,
			p.PassengerID,
			p.SeatID,
			p.TicketNumber,
			p.FareVND,
			p.TaxVND,
			p.InsuranceVND,
			p.CreatedAt,
			p.UpdatedAt,
		)
		if err != nil {
			return apperrors.Internal(fmt.Sprintf("failed to save passenger: %v", err))
		}
	}

	return nil
}

func (r *txBookingRepo) SaveFlights(ctx context.Context, flights []booking.BookingFlight) error {
	if len(flights) == 0 {
		return nil
	}

	for _, f := range flights {
		query := `
			INSERT INTO booking_flights (id, booking_id, flight_instance_id, leg_order,
				fare_vnd, tax_vnd, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT (id) DO UPDATE SET
				leg_order = EXCLUDED.leg_order,
				fare_vnd = EXCLUDED.fare_vnd,
				tax_vnd = EXCLUDED.tax_vnd,
				updated_at = EXCLUDED.updated_at
		`
		_, err := r.tx.Exec(ctx, query,
			f.ID,
			f.BookingID,
			f.FlightInstanceID,
			f.LegOrder,
			f.FareVND,
			f.TaxVND,
			f.CreatedAt,
			f.UpdatedAt,
		)
		if err != nil {
			return apperrors.Internal(fmt.Sprintf("failed to save flight: %v", err))
		}
	}

	return nil
}

func (r *txBookingRepo) WithTx(ctx context.Context, fn func(ctx context.Context) error) error {
	return apperrors.Internal("nested transactions not supported")
}

// withTxContext creates a context that includes the transaction.
func withTxContext(ctx context.Context, txRepo *txBookingRepo) context.Context {
	return context.WithValue(ctx, txRepoKey{}, txRepo)
}

type txRepoKey struct{}

// Ensure BookingRepository implements ports.BookingRepositoryPort
var _ ports.BookingRepositoryPort = (*BookingRepository)(nil)

// ============================================================================
// Audit Log Repository
// ============================================================================

// AuditLogRepository handles audit log persistence.
type AuditLogRepository struct {
	pool *Pool
}

// NewAuditLogRepository creates a new AuditLogRepository.
func NewAuditLogRepository(pool *Pool) *AuditLogRepository {
	return &AuditLogRepository{pool: pool}
}

// Log records an audit log entry.
func (r *AuditLogRepository) Log(ctx context.Context, log *ports.AuditLog) error {
	query := `
		INSERT INTO audit_logs (
			id, timestamp, user_id, action, entity_type, entity_id,
			details, ip_address, user_agent, request_id
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10
		)
	`

	_, err := r.pool.Exec(ctx, query,
		log.ID,
		log.Timestamp,
		log.UserID,
		log.Action,
		log.EntityType,
		log.EntityID,
		log.Details,
		log.IPAddress,
		log.UserAgent,
		log.RequestID,
	)

	if err != nil {
		return apperrors.Internal(fmt.Sprintf("failed to save audit log: %v", err))
	}

	return nil
}

// Ensure AuditLogRepository implements ports.AuditPort
var _ ports.AuditPort = (*AuditLogRepository)(nil)

// ============================================================================
// User Repository
// ============================================================================

// UserRepository handles user data persistence.
type UserRepository struct {
	pool *Pool
}

// NewUserRepository creates a new UserRepository.
func NewUserRepository(pool *Pool) *UserRepository {
	return &UserRepository{pool: pool}
}

// FindByID retrieves a user by their unique identifier.
func (r *UserRepository) FindByID(ctx context.Context, id uuid.UUID) (*entities.User, error) {
	query := `
		SELECT id, email, password_hash, first_name, last_name, role, phone,
		       date_of_birth, nationality, passport_number, avatar_url,
		       is_email_verified, is_phone_verified, is_active,
		       last_login_at, failed_login_count, locked_until,
		       created_at, updated_at
		FROM users
		WHERE id = $1
	`

	var u entities.User
	var dob, lastLogin, lockedUntil *time.Time
	var passwordHash, nationality, passportNumber, avatarURL string

	err := r.pool.QueryRow(ctx, query, id).Scan(
		&u.ID,
		&u.Email,
		&passwordHash,
		&u.FirstName,
		&u.LastName,
		&u.Role,
		&u.Phone,
		&dob,
		&nationality,
		&passportNumber,
		&avatarURL,
		&u.IsEmailVerified,
		&u.IsPhoneVerified,
		&u.IsActive,
		&lastLogin,
		&u.FailedLoginCount,
		&lockedUntil,
		&u.CreatedAt,
		&u.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, apperrors.NotFound(fmt.Sprintf("user with ID %s not found", id))
		}
		return nil, apperrors.Internal(fmt.Sprintf("failed to find user: %v", err))
	}

	u.DateOfBirth = dob
	u.LastLoginAt = lastLogin
	u.LockedUntil = lockedUntil
	u.PasswordHash = passwordHash
	u.Nationality = nationality
	u.PassportNumber = passportNumber
	u.AvatarURL = avatarURL

	return &u, nil
}

// FindByEmail retrieves a user by their email address.
func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*entities.User, error) {
	query := `
		SELECT id, email, password_hash, first_name, last_name, role, phone,
		       date_of_birth, nationality, passport_number, avatar_url,
		       is_email_verified, is_phone_verified, is_active,
		       last_login_at, failed_login_count, locked_until,
		       created_at, updated_at
		FROM users
		WHERE email = $1
	`

	var u entities.User
	var dob, lastLogin, lockedUntil *time.Time
	var passwordHash, nationality, passportNumber, avatarURL string

	err := r.pool.QueryRow(ctx, query, strings.ToLower(email)).Scan(
		&u.ID,
		&u.Email,
		&passwordHash,
		&u.FirstName,
		&u.LastName,
		&u.Role,
		&u.Phone,
		&dob,
		&nationality,
		&passportNumber,
		&avatarURL,
		&u.IsEmailVerified,
		&u.IsPhoneVerified,
		&u.IsActive,
		&lastLogin,
		&u.FailedLoginCount,
		&lockedUntil,
		&u.CreatedAt,
		&u.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, apperrors.NotFound(fmt.Sprintf("user with email %s not found", email))
		}
		return nil, apperrors.Internal(fmt.Sprintf("failed to find user: %v", err))
	}

	u.DateOfBirth = dob
	u.LastLoginAt = lastLogin
	u.LockedUntil = lockedUntil
	u.PasswordHash = passwordHash
	u.Nationality = nationality
	u.PassportNumber = passportNumber
	u.AvatarURL = avatarURL

	return &u, nil
}

// Save persists a user.
func (r *UserRepository) Save(ctx context.Context, u *entities.User) error {
	query := `
		INSERT INTO users (
			id, email, password_hash, first_name, last_name, role, phone,
			date_of_birth, nationality, passport_number, avatar_url,
			is_email_verified, is_phone_verified, is_active,
			last_login_at, failed_login_count, locked_until,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
		)
		ON CONFLICT (id) DO UPDATE SET
			email = EXCLUDED.email,
			password_hash = EXCLUDED.password_hash,
			first_name = EXCLUDED.first_name,
			last_name = EXCLUDED.last_name,
			role = EXCLUDED.role,
			phone = EXCLUDED.phone,
			date_of_birth = EXCLUDED.date_of_birth,
			nationality = EXCLUDED.nationality,
			passport_number = EXCLUDED.passport_number,
			avatar_url = EXCLUDED.avatar_url,
			is_email_verified = EXCLUDED.is_email_verified,
			is_phone_verified = EXCLUDED.is_phone_verified,
			is_active = EXCLUDED.is_active,
			last_login_at = EXCLUDED.last_login_at,
			failed_login_count = EXCLUDED.failed_login_count,
			locked_until = EXCLUDED.locked_until,
			updated_at = EXCLUDED.updated_at
	`

	_, err := r.pool.Exec(ctx, query,
		u.ID,
		u.Email,
		u.PasswordHash,
		u.FirstName,
		u.LastName,
		u.Role,
		u.Phone,
		u.DateOfBirth,
		u.Nationality,
		u.PassportNumber,
		u.AvatarURL,
		u.IsEmailVerified,
		u.IsPhoneVerified,
		u.IsActive,
		u.LastLoginAt,
		u.FailedLoginCount,
		u.LockedUntil,
		u.CreatedAt,
		u.UpdatedAt,
	)

	if err != nil {
		return apperrors.Internal(fmt.Sprintf("failed to save user: %v", err))
	}

	return nil
}

// UpdateLastLogin updates the last login timestamp for a user.
func (r *UserRepository) UpdateLastLogin(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE users
		SET last_login_at = $1, failed_login_count = 0, updated_at = $2
		WHERE id = $3
	`

	now := time.Now()
	_, err := r.pool.Exec(ctx, query, now, now, id)
	if err != nil {
		return apperrors.Internal(fmt.Sprintf("failed to update last login: %v", err))
	}

	return nil
}

// Ensure UserRepository implements ports.UserRepositoryPort
var _ ports.UserRepositoryPort = (*UserRepository)(nil)

// ============================================================================
// Fare Rule Repository
// ============================================================================

// FareRuleRepository handles fare rule persistence.
type FareRuleRepository struct {
	pool *Pool
}

// NewFareRuleRepository creates a new FareRuleRepository.
func NewFareRuleRepository(pool *Pool) *FareRuleRepository {
	return &FareRuleRepository{pool: pool}
}

// FindByRoute retrieves fare rules for a specific route.
func (r *FareRuleRepository) FindByRoute(ctx context.Context, origin, dest, airline string) ([]vo.FareRule, error) {
	var args []interface{}
	argIndex := 1

	query := `
		SELECT id, flight_instance_id, cabin_class, fare_class, base_fare_vnd,
		       fuel_surcharge_vnd, airport_tax_vnd, service_fee_vnd,
		       refundable, change_fee_vnd, cancellation_fee_vnd,
		       luggage_allowance, cabin_baggage, valid_from, valid_to,
		       created_at, updated_at
		FROM fare_rules
		WHERE valid_from <= NOW() AND valid_to >= NOW()
	`

	if origin != "" {
		query += fmt.Sprintf(" AND origin_code = $%d", argIndex)
		args = append(args, origin)
		argIndex++
	}

	if dest != "" {
		query += fmt.Sprintf(" AND destination_code = $%d", argIndex)
		args = append(args, dest)
		argIndex++
	}

	if airline != "" {
		query += fmt.Sprintf(" AND airline_code = $%d", argIndex)
		args = append(args, airline)
	}

	query += " ORDER BY base_fare_vnd"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, apperrors.Internal(fmt.Sprintf("failed to find fare rules: %v", err))
	}
	defer rows.Close()

	var rules []vo.FareRule
	for rows.Next() {
		var rule vo.FareRule
		err := rows.Scan(
			&rule.ID,
			&rule.FlightInstanceID,
			&rule.CabinClass,
			&rule.FareClass,
			&rule.BaseFareVND,
			&rule.FuelSurchargeVND,
			&rule.AirportTaxVND,
			&rule.ServiceFeeVND,
			&rule.Refundable,
			&rule.ChangeFeeVND,
			&rule.CancellationFeeVND,
			&rule.LuggageAllowance,
			&rule.CabinBaggage,
			&rule.ValidFrom,
			&rule.ValidTo,
			&rule.CreatedAt,
			&rule.UpdatedAt,
		)
		if err != nil {
			return nil, apperrors.Internal(fmt.Sprintf("failed to scan fare rule: %v", err))
		}
		rules = append(rules, rule)
	}

	return rules, nil
}

// FindByCabinClass retrieves fare rules for a cabin class.
func (r *FareRuleRepository) FindByCabinClass(ctx context.Context, airline string, cabin valueobjects.CabinClass) ([]vo.FareRule, error) {
	var args []interface{}
	argIndex := 1

	query := `
		SELECT id, flight_instance_id, cabin_class, fare_class, base_fare_vnd,
		       fuel_surcharge_vnd, airport_tax_vnd, service_fee_vnd,
		       refundable, change_fee_vnd, cancellation_fee_vnd,
		       luggage_allowance, cabin_baggage, valid_from, valid_to,
		       created_at, updated_at
		FROM fare_rules
		WHERE valid_from <= NOW() AND valid_to >= NOW()
		  AND cabin_class = $1
	`

	args = append(args, string(cabin))
	argIndex++

	if airline != "" {
		query += fmt.Sprintf(" AND airline_code = $%d", argIndex)
		args = append(args, airline)
	}

	query += " ORDER BY base_fare_vnd"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, apperrors.Internal(fmt.Sprintf("failed to find fare rules: %v", err))
	}
	defer rows.Close()

	var rules []vo.FareRule
	for rows.Next() {
		var rule vo.FareRule
		err := rows.Scan(
			&rule.ID,
			&rule.FlightInstanceID,
			&rule.CabinClass,
			&rule.FareClass,
			&rule.BaseFareVND,
			&rule.FuelSurchargeVND,
			&rule.AirportTaxVND,
			&rule.ServiceFeeVND,
			&rule.Refundable,
			&rule.ChangeFeeVND,
			&rule.CancellationFeeVND,
			&rule.LuggageAllowance,
			&rule.CabinBaggage,
			&rule.ValidFrom,
			&rule.ValidTo,
			&rule.CreatedAt,
			&rule.UpdatedAt,
		)
		if err != nil {
			return nil, apperrors.Internal(fmt.Sprintf("failed to scan fare rule: %v", err))
		}
		rules = append(rules, rule)
	}

	return rules, nil
}

// Save persists a fare rule.
func (r *FareRuleRepository) Save(ctx context.Context, rule *vo.FareRule) error {
	query := `
		INSERT INTO fare_rules (
			id, flight_instance_id, cabin_class, fare_class, base_fare_vnd,
			fuel_surcharge_vnd, airport_tax_vnd, service_fee_vnd,
			refundable, change_fee_vnd, cancellation_fee_vnd,
			luggage_allowance, cabin_baggage, valid_from, valid_to,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
		)
		ON CONFLICT (id) DO UPDATE SET
			cabin_class = EXCLUDED.cabin_class,
			fare_class = EXCLUDED.fare_class,
			base_fare_vnd = EXCLUDED.base_fare_vnd,
			fuel_surcharge_vnd = EXCLUDED.fuel_surcharge_vnd,
			airport_tax_vnd = EXCLUDED.airport_tax_vnd,
			service_fee_vnd = EXCLUDED.service_fee_vnd,
			refundable = EXCLUDED.refundable,
			change_fee_vnd = EXCLUDED.change_fee_vnd,
			cancellation_fee_vnd = EXCLUDED.cancellation_fee_vnd,
			luggage_allowance = EXCLUDED.luggage_allowance,
			cabin_baggage = EXCLUDED.cabin_baggage,
			valid_from = EXCLUDED.valid_from,
			valid_to = EXCLUDED.valid_to,
			updated_at = EXCLUDED.updated_at
	`

	_, err := r.pool.Exec(ctx, query,
		rule.ID,
		rule.FlightInstanceID,
		rule.CabinClass,
		rule.FareClass,
		rule.BaseFareVND,
		rule.FuelSurchargeVND,
		rule.AirportTaxVND,
		rule.ServiceFeeVND,
		rule.Refundable,
		rule.ChangeFeeVND,
		rule.CancellationFeeVND,
		rule.LuggageAllowance,
		rule.CabinBaggage,
		rule.ValidFrom,
		rule.ValidTo,
		rule.CreatedAt,
		rule.UpdatedAt,
	)

	if err != nil {
		return apperrors.Internal(fmt.Sprintf("failed to save fare rule: %v", err))
	}

	return nil
}

// Ensure FareRuleRepository implements ports.FareRuleRepositoryPort
var _ ports.FareRuleRepositoryPort = (*FareRuleRepository)(nil)
