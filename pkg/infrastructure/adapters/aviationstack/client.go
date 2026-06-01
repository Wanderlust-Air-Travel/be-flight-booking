package aviationstack

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"

	"flight-booking/pkg/application/ports"
	"flight-booking/pkg/domain/entities/flight"
	"flight-booking/pkg/domain/valueobjects"
	"flight-booking/pkg/domain/valueobjects/vo"
	apperrors "flight-booking/pkg/shared/errors"
	"flight-booking/pkg/shared/logger"
)

const (
	defaultTimeout    = 10 * time.Second
	defaultRetryCount = 3
	baseRatePerKm     = 200.0
	fuelSurcharge     = 330000
	airportTax        = 400000
	serviceFee        = 200000
)

// Config holds the configuration for the Aviationstack API client.
type Config struct {
	APIKey        string
	BaseURL       string
	Timeout       time.Duration
	RetryAttempts int
}

// Client wraps the Aviationstack API client.
type Client struct {
	baseURL     string
	apiKey      string
	httpClient  *http.Client
	timeout     time.Duration
	retryCount  int
	log         *logger.Logger
}

// NewClient creates a new Aviationstack API client.
func NewClient(cfg Config, log *logger.Logger) *Client {
	timeout := cfg.Timeout
	if timeout == 0 {
		timeout = defaultTimeout
	}
	retryCount := cfg.RetryAttempts
	if retryCount == 0 {
		retryCount = defaultRetryCount
	}

	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = "https://api.aviationstack.com/v1"
	}

	return &Client{
		baseURL:    baseURL,
		apiKey:     cfg.APIKey,
		httpClient: &http.Client{Timeout: timeout},
		timeout:    timeout,
		retryCount: retryCount,
		log:        log,
	}
}

// Ensure Client implements FlightProviderPort
var _ ports.FlightProviderPort = (*Client)(nil)

// SearchFlights searches for available flights.
func (c *Client) SearchFlights(ctx context.Context, req ports.SearchFlightRequest) (*ports.SearchFlightResponse, error) {
	start := time.Now()

	if c.apiKey == "" {
		c.log.Info("API key empty, using mock data", logger.Fields{"origin": req.Origin, "dest": req.Destination})
		return c.mockSearchFlights(ctx, req)
	}

	url := c.buildSearchURL(req)
	c.log.Debug("Searching flights", logger.Fields{"url": url})

	var apiResp apiFlightResponse
	err := c.doWithRetry(ctx, http.MethodGet, url, nil, &apiResp)
	if err != nil {
		return nil, err
	}

	results := c.mapToFlightResults(apiResp.Data, req)
	durationMs := time.Since(start).Milliseconds()

	return &ports.SearchFlightResponse{
		Flights:    results,
		Provider:   "aviationstack",
		QueriedAt:  time.Now(),
		DurationMs: durationMs,
	}, nil
}

// GetFlightByNumber retrieves a flight by number and date.
func (c *Client) GetFlightByNumber(ctx context.Context, flightNumber, date string) (*flight.FlightInstance, error) {
	if c.apiKey == "" {
		return c.mockGetFlightByNumber(ctx, flightNumber, date)
	}

	searchReq := ports.SearchFlightRequest{
		Origin:        "",
		Destination:   "",
		DepartureDate: date,
	}
	url := c.buildSearchURL(searchReq) + "&flight_number=" + url.QueryEscape(flightNumber)

	var apiResp apiFlightResponse
	err := c.doWithRetry(ctx, http.MethodGet, url, nil, &apiResp)
	if err != nil {
		return nil, err
	}

	if len(apiResp.Data) == 0 {
		return nil, apperrors.NotFound(fmt.Sprintf("flight %s not found on %s", flightNumber, date))
	}

	return c.mapToFlightInstance(&apiResp.Data[0]), nil
}

// GetFlightStatus retrieves the status of a flight.
func (c *Client) GetFlightStatus(ctx context.Context, flightNumber, date string) (flight.FlightStatus, error) {
	if c.apiKey == "" {
		return flight.StatusScheduled, nil
	}

	searchReq := ports.SearchFlightRequest{
		Origin:        "",
		Destination:   "",
		DepartureDate: date,
	}
	url := c.buildSearchURL(searchReq) + "&flight_number=" + url.QueryEscape(flightNumber)

	var apiResp apiFlightResponse
	err := c.doWithRetry(ctx, http.MethodGet, url, nil, &apiResp)
	if err != nil {
		return "", err
	}

	if len(apiResp.Data) == 0 {
		return "", apperrors.NotFound(fmt.Sprintf("flight %s not found on %s", flightNumber, date))
	}

	return c.mapStatus(apiResp.Data[0].FlightStatus), nil
}

// IsAvailable checks if the flight provider is available.
func (c *Client) IsAvailable(ctx context.Context) bool {
	if c.apiKey == "" {
		return true
	}

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	testURL := fmt.Sprintf("%s/flights?access_key=%s&limit=1", c.baseURL, c.apiKey)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, testURL, nil)
	if err != nil {
		return false
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK
}

// doWithRetry performs an HTTP request with exponential backoff retry logic.
func (c *Client) doWithRetry(ctx context.Context, method, url string, body interface{}, result interface{}) error {
	var lastErr error

	for attempt := 0; attempt <= c.retryCount; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(math.Pow(2, float64(attempt))) * 100 * time.Millisecond
			jitter := time.Duration(rand.Int63n(int64(backoff / 2)))
			sleep := backoff + jitter

			c.log.Debug("Retrying request", logger.Fields{
				"attempt": attempt,
				"sleep":   sleep,
				"url":     url,
			})

			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(sleep):
			}
		}

		req, err := http.NewRequestWithContext(ctx, method, url, nil)
		if err != nil {
			lastErr = err
			continue
		}

		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept", "application/json")

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusTooManyRequests {
			lastErr = apperrors.TooManyRequests("rate limit exceeded")
			continue
		}

		if resp.StatusCode == http.StatusUnauthorized {
			return apperrors.Unauthorized("invalid API key")
		}

		if resp.StatusCode == http.StatusBadRequest {
			var errResp apiError
			if err := json.NewDecoder(resp.Body).Decode(&errResp); err == nil {
				return apperrors.BadRequest(errResp.Error.Message)
			}
			return apperrors.BadRequest("invalid request")
		}

		if resp.StatusCode != http.StatusOK {
			lastErr = fmt.Errorf("unexpected status code: %d", resp.StatusCode)
			continue
		}

		if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
			lastErr = err
			continue
		}

		return nil
	}

	if lastErr != nil {
		return apperrors.ExternalAPI(fmt.Sprintf("failed after %d attempts: %v", c.retryCount+1, lastErr))
	}
	return nil
}

// buildSearchURL constructs the API URL for flight search.
func (c *Client) buildSearchURL(req ports.SearchFlightRequest) string {
	params := url.Values{}
	params.Set("access_key", c.apiKey)
	params.Set("airline_iata", "VN,VJ,QH,VU")

	if req.Origin != "" {
		params.Set("dep_iata", req.Origin)
	}
	if req.Destination != "" {
		params.Set("arr_iata", req.Destination)
	}
	if req.DepartureDate != "" {
		params.Set("flight_date", req.DepartureDate)
	}
	params.Set("limit", "50")

	return fmt.Sprintf("%s/flights?%s", c.baseURL, params.Encode())
}

// mapToFlightResults maps API response data to FlightSearchResult array.
func (c *Client) mapToFlightResults(data []apiFlightData, req ports.SearchFlightRequest) []ports.FlightSearchResult {
	results := make([]ports.FlightSearchResult, 0, len(data))

	for _, f := range data {
		if f.FlightStatus != nil && strings.ToUpper(*f.FlightStatus) == "CANCELLED" {
			continue
		}

		flightInstance := c.mapToFlightInstance(&f)
		if flightInstance == nil {
			continue
		}

		duration := flightInstance.ScheduledArrival.Sub(flightInstance.ScheduledDeparture)
		distance := c.estimateDistance(flightInstance.OriginCode, flightInstance.DestinationCode)
		price := c.calculateFareFromAPI(distance, valueobjects.CabinClass(req.CabinClass), duration)

		seats := c.estimateSeats(flightInstance.AircraftType)

		result := ports.FlightSearchResult{
			Flight:    flightInstance,
			Price:     price,
			SeatsLeft: seats,
			Stops:     0,
		}

		results = append(results, result)
	}

	return results
}

// mapToFlightInstance maps API flight data to FlightInstance entity.
func (c *Client) mapToFlightInstance(data *apiFlightData) *flight.FlightInstance {
	if data == nil {
		return nil
	}

	depTime := time.Time{}
	if data.DepartureTime != nil {
		depTime = *data.DepartureTime
	}

	arrTime := time.Time{}
	if data.ArrivalTime != nil {
		arrTime = *data.ArrivalTime
	}

	aircraftType := ""
	if data.Aircraft != nil && len(data.Aircraft) > 0 && data.Aircraft[0].IcaoCode != nil {
		aircraftType = *data.Aircraft[0].IcaoCode
	}

	depTerminal := ""
	if data.DepartureTerminal != nil {
		depTerminal = *data.DepartureTerminal
	}

	arrTerminal := ""
	if data.ArrivalTerminal != nil {
		arrTerminal = *data.ArrivalTerminal
	}

	flightNum := ""
	if data.Flight != nil && data.Flight.Number != nil {
		flightNum = *data.Flight.Number
	}

	airlineCode := ""
	if data.Airline != nil && data.Airline.IataCode != nil {
		airlineCode = *data.Airline.IataCode
	}

	depAirport := ""
	if data.Departure != nil && data.Departure.IataCode != nil {
		depAirport = *data.Departure.IataCode
	}

	arrAirport := ""
	if data.Arrival != nil && data.Arrival.IataCode != nil {
		arrAirport = *data.Arrival.IataCode
	}

	capacity := c.getAircraftCapacity(aircraftType)

	return &flight.FlightInstance{
		ID:                uuid.New(),
		FlightNumber:      flightNum,
		RouteID:           uuid.New(),
		AirlineCode:       airlineCode,
		OriginCode:        depAirport,
		DestinationCode:   arrAirport,
		ScheduledDeparture: depTime,
		ScheduledArrival:  arrTime,
		DepartureTerminal: depTerminal,
		ArrivalTerminal:   arrTerminal,
		AircraftType:      aircraftType,
		AvailableSeats:    c.estimateSeats(aircraftType),
		TotalSeats:        capacity,
		Status:            c.mapStatus(data.FlightStatus),
		CabinClass:        flight.CabinEconomy,
		Gate:              "",
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}
}

// mapStatus maps API status string to FlightStatus enum.
func (c *Client) mapStatus(status *string) flight.FlightStatus {
	if status == nil {
		return flight.StatusScheduled
	}

	switch strings.ToUpper(*status) {
	case "SCHEDULED":
		return flight.StatusScheduled
	case "ACTIVE", "EN-ROUTE", "IN_AIR":
		return flight.StatusInAir
	case "LANDED":
		return flight.StatusLanded
	case "CANCELLED":
		return flight.StatusCancelled
	case "INCIDENT", "DIVERTED":
		return flight.StatusDelayed
	case "DELAYED":
		return flight.StatusDelayed
	default:
		return flight.StatusScheduled
	}
}

// calculateFareFromAPI calculates fare based on distance and cabin class.
func (c *Client) calculateFareFromAPI(distanceKm float64, cabinClass valueobjects.CabinClass, duration time.Duration) vo.PriceBreakdown {
	baseFare := int64(distanceKm * baseRatePerKm)
	multiplier := cabinClass.Multiplier()

	if multiplier == 0 {
		multiplier = 1.0
	}

	totalFare := int64(float64(baseFare) * multiplier)
	totalFare += fuelSurcharge + airportTax + serviceFee

	return vo.PriceBreakdown{
		BaseFare:      vo.NewMoneyVND(baseFare),
		FuelSurcharge: vo.NewMoneyVND(fuelSurcharge),
		AirportTax:    vo.NewMoneyVND(airportTax),
		ServiceFee:    vo.NewMoneyVND(serviceFee),
		Subtotal:      vo.NewMoneyVND(totalFare),
		Discount:      vo.NewMoneyVND(0),
		Total:         vo.NewMoneyVND(totalFare),
	}
}

// estimateSeats estimates available seats based on aircraft type.
func (c *Client) estimateSeats(aircraftType string) int {
	baseSeats := 30
	extraSeats := rand.Intn(100)
	return baseSeats + extraSeats
}

// getAircraftCapacity returns seat capacity for aircraft types.
func (c *Client) getAircraftCapacity(icaoCode string) int {
	capacities := map[string]int{
		"A320":  180,
		"A321":  220,
		"A330":  300,
		"A350":  325,
		"A380":  575,
		"B737":  189,
		"B738":  189,
		"B739":  210,
		"B747":  416,
		"B777":  396,
		"B787":  242,
	}

	if cap, ok := capacities[icaoCode]; ok {
		return cap
	}
	return 180
}

// estimateDistance estimates distance between airports (rough approximation).
func (c *Client) estimateDistance(origin, dest string) float64 {
	routeDistances := map[string]float64{
		"HANSGN": 1720,
		"HANDAD": 120,
		"SGNDAD": 40,
		"SGNCXR": 300,
		"HANCXR": 350,
		"DADCXR": 280,
	}

	key := strings.ToUpper(origin + dest)
	if dist, ok := routeDistances[key]; ok {
		return dist
	}

	baseDistance := 500.0
	for i := 0; i < len(origin)+len(dest); i++ {
		baseDistance += 50
	}
	return baseDistance
}

// ============================================================================
// API Response Types
// ============================================================================

type apiFlightResponse struct {
	Meta      apiPagination `json:"meta"`
	Data     []apiFlightData `json:"data"`
	Error    *apiErrorInfo   `json:"error,omitempty"`
}

type apiPagination struct {
	RequestID     *int   `json:"request_id,omitempty"`
	Count        int    `json:"count"`
	Page         int    `json:"page"`
	Limit        int    `json:"limit"`
	LastUpdated  *string `json:"last_updated,omitempty"`
}

type apiFlightData struct {
	ID                *int64            `json:"id,omitempty"`
	FlightDate        *string           `json:"flight_date,omitempty"`
	FlightStatus      *string           `json:"flight_status,omitempty"`
	Departure         *apiAirportInfo   `json:"departure,omitempty"`
	Arrival           *apiAirportInfo   `json:"arrival,omitempty"`
	Airline           *apiAirlineID     `json:"airline,omitempty"`
	Flight            *apiFlightID      `json:"flight,omitempty"`
	Aircraft          []apiAircraft     `json:"aircraft,omitempty"`
	DepartureTime     *time.Time        `json:"departure_time,omitempty"`
	ArrivalTime       *time.Time        `json:"arrival_time,omitempty"`
	DepartureTerminal *string           `json:"departure_terminal,omitempty"`
	ArrivalTerminal   *string           `json:"arrival_terminal,omitempty"`
}

type apiAirportInfo struct {
	AirportID    *int64   `json:"airport_id,omitempty"`
	GATEIATA     *string  `json:"gate_iata,omitempty"`
	IataCode     *string  `json:"iata_code,omitempty"`
	IcaoCode     *string  `json:"icao_code,omitempty"`
	Delay        *int     `json:"delay,omitempty"`
	Scheduled    *string  `json:"scheduled,omitempty"`
	Estimated    *string  `json:"estimated,omitempty"`
	Actual       *string  `json:"actual,omitempty"`
	Terminal     *string  `json:"terminal,omitempty"`
	Baggage      *string  `json:"baggage,omitempty"`
}

type apiAirlineID struct {
	AirlineID *int64  `json:"airline_id,omitempty"`
	Name      *string `json:"name,omitempty"`
	IataCode  *string `json:"iata_code,omitempty"`
	IcaoCode  *string `json:"icao_code,omitempty"`
}

type apiFlightID struct {
	Number     *string `json:"number,omitempty"`
	IataNumber *string `json:"iata_number,omitempty"`
	IcaoNumber *string `json:"icao_number,omitempty"`
}

type apiAircraft struct {
	IcaoCode *string `json:"icao_code,omitempty"`
}

type apiError struct {
	Status      bool          `json:"status"`
	Error      apiErrorInfo   `json:"error"`
}

type apiErrorInfo struct {
	Code    int    `json:"code"`
	Type    string `json:"type"`
	Message string `json:"message"`
	Info    string `json:"info,omitempty"`
}

// ============================================================================
// Mock Data Methods
// ============================================================================

// mockSearchFlights returns mock flight data when API key is not configured.
func (c *Client) mockSearchFlights(ctx context.Context, req ports.SearchFlightRequest) (*ports.SearchFlightResponse, error) {
	start := time.Now()

	departureDate, err := time.Parse("2006-01-02", req.DepartureDate)
	if err != nil {
		departureDate = time.Now().AddDate(0, 0, 1)
	}

	schedules := c.getMockSchedule(req.Origin, req.Destination)
	results := make([]ports.FlightSearchResult, 0, len(schedules))

	for _, schedule := range schedules {
		depTime := time.Date(
			departureDate.Year(), departureDate.Month(), departureDate.Day(),
			schedule.DepartureHour, schedule.DepartureMinute, 0, 0, time.UTC,
		)
		arrTime := depTime.Add(time.Duration(schedule.DurationMinutes) * time.Minute)

		distance := c.estimateDistance(req.Origin, req.Destination)
		price := c.calculateFareFromAPI(distance, valueobjects.CabinClass(req.CabinClass),
			time.Duration(schedule.DurationMinutes)*time.Minute)

		flightInstance := &flight.FlightInstance{
			ID:                 uuid.New(),
			FlightNumber:       schedule.FlightNumber,
			RouteID:            uuid.New(),
			AirlineCode:        schedule.Airline,
			OriginCode:         req.Origin,
			DestinationCode:    req.Destination,
			ScheduledDeparture: depTime,
			ScheduledArrival:   arrTime,
			DepartureTerminal:  "T1",
			ArrivalTerminal:    "T1",
			AircraftType:       schedule.AircraftType,
			AvailableSeats:     c.estimateSeats(schedule.AircraftType),
			TotalSeats:         c.getAircraftCapacity(schedule.AircraftType),
			Status:             flight.StatusScheduled,
			CabinClass:         flight.CabinEconomy,
			Gate:               "",
			CreatedAt:          time.Now(),
			UpdatedAt:          time.Now(),
		}

		results = append(results, ports.FlightSearchResult{
			Flight:    flightInstance,
			Price:     price,
			SeatsLeft: flightInstance.AvailableSeats,
			Stops:     0,
		})
	}

	durationMs := time.Since(start).Milliseconds()

	return &ports.SearchFlightResponse{
		Flights:    results,
		Provider:   "mock",
		QueriedAt:  time.Now(),
		DurationMs: durationMs,
	}, nil
}

// mockSchedule represents a mock flight schedule.
type mockSchedule struct {
	FlightNumber     string
	Airline          string
	DepartureHour    int
	DepartureMinute  int
	DurationMinutes  int
	AircraftType     string
}

// getMockSchedule returns realistic flight schedules for known routes.
func (c *Client) getMockSchedule(origin, dest string) []mockSchedule {
	route := strings.ToUpper(origin + dest)

	switch route {
	case "HANSGN":
		return []mockSchedule{
			{"VN209", "VN", 6, 30, 120, "A321"},
			{"VN213", "VN", 8, 45, 115, "A321"},
			{"VJ151", "VJ", 9, 0, 125, "A320"},
			{"VJ157", "VJ", 11, 15, 120, "A320"},
			{"QH217", "QH", 13, 30, 118, "A321"},
			{"QH223", "QH", 16, 0, 122, "A321"},
			{"VU210", "VU", 18, 30, 120, "A320"},
		}
	case "SGNHAN":
		return []mockSchedule{
			{"VN208", "VN", 7, 0, 125, "A321"},
			{"VN212", "VN", 10, 30, 120, "A321"},
			{"VJ150", "VJ", 12, 0, 128, "A320"},
			{"VJ156", "VJ", 14, 30, 125, "A320"},
			{"QH216", "QH", 17, 0, 120, "A321"},
		}
	case "HANDAD":
		return []mockSchedule{
			{"VN206", "VN", 6, 0, 70, "A320"},
			{"VJ231", "VJ", 8, 30, 65, "A320"},
			{"QH201", "QH", 11, 0, 70, "A321"},
		}
	case "DADHAN":
		return []mockSchedule{
			{"VN205", "VN", 7, 30, 75, "A320"},
			{"VJ230", "VJ", 10, 0, 70, "A320"},
		}
	case "SGNDAD":
		return []mockSchedule{
			{"VJ621", "VJ", 7, 0, 55, "A320"},
			{"VN685", "VN", 9, 30, 50, "A321"},
		}
	case "DADSGN":
		return []mockSchedule{
			{"VJ620", "VJ", 8, 0, 55, "A320"},
			{"VN680", "VN", 11, 0, 50, "A321"},
		}
	case "SGNCXR":
		return []mockSchedule{
			{"VJ951", "VJ", 7, 30, 90, "A320"},
			{"VN945", "VN", 10, 0, 85, "A321"},
		}
	case "CXRHAN":
		return []mockSchedule{
			{"VJ950", "VJ", 8, 30, 95, "A320"},
			{"VN940", "VN", 12, 0, 90, "A321"},
		}
	default:
		return []mockSchedule{
			{FmtFlightNum("XX", 100), "XX", 8, 0, 120, "A320"},
			{FmtFlightNum("XX", 200), "XX", 14, 30, 125, "A321"},
		}
	}
}

// FmtFlightNum formats a flight number string.
func FmtFlightNum(prefix string, num int) string {
	return fmt.Sprintf("%s%d", prefix, num)
}

// mockGetFlightByNumber returns mock flight by number.
func (c *Client) mockGetFlightByNumber(ctx context.Context, flightNumber, date string) (*flight.FlightInstance, error) {
	departureDate, err := time.Parse("2006-01-02", date)
	if err != nil {
		departureDate = time.Now().AddDate(0, 0, 1)
	}

	schedules := c.getMockSchedule("HAN", "SGN")
	for _, schedule := range schedules {
		if schedule.FlightNumber == flightNumber {
			depTime := time.Date(
				departureDate.Year(), departureDate.Month(), departureDate.Day(),
				schedule.DepartureHour, schedule.DepartureMinute, 0, 0, time.UTC,
			)
			arrTime := depTime.Add(time.Duration(schedule.DurationMinutes) * time.Minute)

			return &flight.FlightInstance{
				ID:                 uuid.New(),
				FlightNumber:       schedule.FlightNumber,
				RouteID:            uuid.New(),
				AirlineCode:        schedule.Airline,
				OriginCode:         "HAN",
				DestinationCode:    "SGN",
				ScheduledDeparture: depTime,
				ScheduledArrival:   arrTime,
				DepartureTerminal:  "T1",
				ArrivalTerminal:    "T1",
				AircraftType:       schedule.AircraftType,
				AvailableSeats:     c.estimateSeats(schedule.AircraftType),
				TotalSeats:         c.getAircraftCapacity(schedule.AircraftType),
				Status:             flight.StatusScheduled,
				CabinClass:         flight.CabinEconomy,
				Gate:               "",
				CreatedAt:          time.Now(),
				UpdatedAt:          time.Now(),
			}, nil
		}
	}

	return nil, apperrors.NotFound(fmt.Sprintf("flight %s not found", flightNumber))
}
