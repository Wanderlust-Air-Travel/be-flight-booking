// pkg/application/usecases/usecases.go
// Application Use Cases
//
// This file contains all business logic use cases for the flight booking system.
// Use cases orchestrate the flow of data between entities and ports.

package usecases

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"

	"flight-booking/pkg/application/dto"
	"flight-booking/pkg/application/ports"
	"flight-booking/pkg/domain/entities/booking"
	"flight-booking/pkg/domain/entities/flight"
	"flight-booking/pkg/domain/valueobjects"
	"flight-booking/pkg/domain/valueobjects/vo"
)

// ============================================================================
// Search Flights Use Case
// ============================================================================

// SearchFlightsUseCase handles flight search operations.
type SearchFlightsUseCase struct {
	flightProvider ports.FlightProviderPort
	flightRepo    ports.FlightRepositoryPort
	fareService   ports.FareServicePort
	cache         ports.CachePort
	log           *slog.Logger
}

// NewSearchFlightsUseCase creates a new SearchFlightsUseCase.
func NewSearchFlightsUseCase(
	flightProvider ports.FlightProviderPort,
	flightRepo ports.FlightRepositoryPort,
	fareService ports.FareServicePort,
	cache ports.CachePort,
	log *slog.Logger,
) *SearchFlightsUseCase {
	return &SearchFlightsUseCase{
		flightProvider: flightProvider,
		flightRepo:    flightRepo,
		fareService:   fareService,
		cache:         cache,
		log:           log,
	}
}

// SearchFlightsInput represents the input for the SearchFlights use case.
type SearchFlightsInput struct {
	Origin        string
	Destination   string
	DepartureDate string
	ReturnDate    string
	Passengers    int
	CabinClass    string
	DirectOnly    bool
}

// Execute searches for flights based on the input criteria.
func (uc *SearchFlightsUseCase) Execute(ctx context.Context, input SearchFlightsInput) (*dto.SearchFlightsResponse, error) {
	startTime := time.Now()

	// Build cache key
	cacheKey := uc.buildFlightSearchCacheKey(input)

	// Check cache first
	if uc.cache != nil {
		cachedData, found, err := uc.cache.Get(ctx, cacheKey)
		if err == nil && found {
			uc.log.Info("cache hit for flight search", "key", cacheKey)
			var response dto.SearchFlightsResponse
			if err := json.Unmarshal(cachedData, &response); err == nil {
				return &response, nil
			}
		}
	}

	// Normalize input
	input.Origin = strings.ToUpper(input.Origin)
	input.Destination = strings.ToUpper(input.Destination)
	input.CabinClass = strings.ToLower(input.CabinClass)

	// Convert cabin class
	cabinClass, err := valueobjects.NewCabinClass(input.CabinClass)
	if err != nil {
		return nil, fmt.Errorf("invalid cabin class: %w", err)
	}

	// Build search request for provider
	providerReq := ports.SearchFlightRequest{
		Origin:        input.Origin,
		Destination:   input.Destination,
		DepartureDate: input.DepartureDate,
		Passengers:    input.Passengers,
		CabinClass:    cabinClass,
		DirectOnly:    input.DirectOnly,
	}

	// Query flight provider (Aviationstack)
	providerResp, err := uc.flightProvider.SearchFlights(ctx, providerReq)
	if err != nil {
		uc.log.Error("failed to search flights from provider", "error", err)
		return nil, fmt.Errorf("failed to search flights: %w", err)
	}

	// Convert provider response to DTOs
	outboundFlights := make([]dto.FlightResultDTO, 0, len(providerResp.Flights))
	for _, result := range providerResp.Flights {
		flightDTO, err := uc.toFlightResultDTO(ctx, result, input.Passengers, cabinClass)
		if err != nil {
			uc.log.Warn("failed to convert flight result", "error", err)
			continue
		}
		outboundFlights = append(outboundFlights, *flightDTO)
	}

	// Build response
	response := &dto.SearchFlightsResponse{
		SearchID:        uuid.New(),
		Origin:          input.Origin,
		Destination:    input.Destination,
		DepartureDate:  input.DepartureDate,
		ReturnDate:     input.ReturnDate,
		OutboundFlights: outboundFlights,
		Provider:       providerResp.Provider,
		DurationMs:     time.Since(startTime).Milliseconds(),
		QueriedAt:      providerResp.QueriedAt,
	}

	// Search return flights if return date is provided
	if input.ReturnDate != "" {
		returnReq := ports.SearchFlightRequest{
			Origin:        input.Destination,
			Destination:   input.Origin,
			DepartureDate: input.ReturnDate,
			Passengers:    input.Passengers,
			CabinClass:    cabinClass,
			DirectOnly:    input.DirectOnly,
		}

		returnResp, err := uc.flightProvider.SearchFlights(ctx, returnReq)
		if err == nil {
			returnFlights := make([]dto.FlightResultDTO, 0, len(returnResp.Flights))
			for _, result := range returnResp.Flights {
				flightDTO, err := uc.toFlightResultDTO(ctx, result, input.Passengers, cabinClass)
				if err != nil {
					continue
				}
				returnFlights = append(returnFlights, *flightDTO)
			}
			response.ReturnFlights = returnFlights
		}
	}

	// Cache result for 5 minutes
	if uc.cache != nil {
		if data, err := json.Marshal(response); err == nil {
			_ = uc.cache.Set(ctx, cacheKey, data, 5*time.Minute)
		}
	}

	// Log search completion
	uc.log.Info("flight search completed",
		"origin", input.Origin,
		"destination", input.Destination,
		"outbound_count", len(outboundFlights),
		"return_count", len(response.ReturnFlights),
		"duration_ms", response.DurationMs,
	)

	return response, nil
}

// toFlightResultDTO converts a FlightSearchResult to FlightResultDTO.
func (uc *SearchFlightsUseCase) toFlightResultDTO(
	ctx context.Context,
	result ports.FlightSearchResult,
	passengers int,
	cabinClass valueobjects.CabinClass,
) (*dto.FlightResultDTO, error) {
	// Calculate fare if flight instance is available
	var price vo.PriceBreakdown
	if result.Flight != nil {
		routeInfo := ports.RouteInfo{
			Origin:        result.Flight.OriginCode,
			Destination:   result.Flight.DestinationCode,
			Airline:       result.Flight.AirlineCode,
			FlightNumber:  result.Flight.FlightNumber,
			DepartureTime: result.Flight.DepartureTime,
			Duration:      result.Flight.Duration,
		}
		calculatedPrice, err := uc.calculateFare(ctx, routeInfo, cabinClass, passengers)
		if err != nil {
			uc.log.Warn("failed to calculate fare", "error", err)
			price = result.Price
		} else {
			price = *calculatedPrice
		}
	} else {
		price = result.Price
	}

	// Determine stops and connection info
	stops := result.Stops
	connection := result.Connection
	if stops == 0 && connection == "" {
		connection = "Direct"
	}

	// Build DTO
	flightDTO := dto.FlightResultDTO{
		ID:              result.Flight.ID,
		FlightNumber:    result.Flight.FlightNumber,
		AirlineCode:     result.Flight.AirlineCode,
		AirlineName:     result.Flight.AirlineName,
		Origin:          result.Flight.OriginCode,
		Destination:     result.Flight.DestinationCode,
		DepartureDate:   result.Flight.DepartureDate.Format("2006-01-02"),
		DepartureTime:   result.Flight.DepartureTime.Format("15:04"),
		ArrivalDate:     result.Flight.ArrivalDate.Format("2006-01-02"),
		ArrivalTime:     result.Flight.ArrivalTime.Format("15:04"),
		Duration:        result.Flight.Duration.String(),
		DurationMinutes: int(result.Flight.Duration.Minutes()),
		AircraftType:    result.Flight.AircraftType,
		Stops:           stops,
		Connection:      connection,
		SeatsAvailable:  result.SeatsLeft,
		Status:          string(result.Flight.Status),
		CabinClass:      string(cabinClass),
		Price:           dto.ToPriceDTO(price),
		BaggageAllowance: dto.BaggageAllowance{
			CheckedBag: 1,
			CabinBag:   1,
			WeightKg:   23,
		},
	}

	return &flightDTO, nil
}

// calculateFare calculates the fare for a flight.
func (uc *SearchFlightsUseCase) calculateFare(
	ctx context.Context,
	routeInfo ports.RouteInfo,
	cabinClass valueobjects.CabinClass,
	passengers int,
) (*vo.PriceBreakdown, error) {
	if uc.fareService == nil {
		return nil, fmt.Errorf("fare service not available")
	}

	return uc.fareService.Calculate(ctx, routeInfo, cabinClass, passengers)
}

// buildFlightSearchCacheKey generates a cache key for flight search.
func (uc *SearchFlightsUseCase) buildFlightSearchCacheKey(input SearchFlightsInput) string {
	keyData := fmt.Sprintf("%s:%s:%s:%s:%d:%s:%t",
		input.Origin,
		input.Destination,
		input.DepartureDate,
		input.ReturnDate,
		input.Passengers,
		strings.ToLower(input.CabinClass),
		input.DirectOnly,
	)

	hash := sha256.Sum256([]byte(keyData))
	return fmt.Sprintf("flight:search:%s", hex.EncodeToString(hash[:16]))
}

// ============================================================================
// Create Booking Use Case
// ============================================================================

// CreateBookingUseCase handles booking creation operations.
type CreateBookingUseCase struct {
	bookingRepo    ports.BookingRepositoryPort
	flightRepo     ports.FlightRepositoryPort
	paymentPort    ports.PaymentPort
	notifPort      ports.NotificationPort
	bookingGen     ports.BookingCodeGeneratorPort
	validationSvc  ports.ValidationServicePort
	log            *slog.Logger
}

// NewCreateBookingUseCase creates a new CreateBookingUseCase.
func NewCreateBookingUseCase(
	bookingRepo ports.BookingRepositoryPort,
	flightRepo ports.FlightRepositoryPort,
	paymentPort ports.PaymentPort,
	notifPort ports.NotificationPort,
	bookingGen ports.BookingCodeGeneratorPort,
	validationSvc ports.ValidationServicePort,
	log *slog.Logger,
) *CreateBookingUseCase {
	return &CreateBookingUseCase{
		bookingRepo:    bookingRepo,
		flightRepo:     flightRepo,
		paymentPort:    paymentPort,
		notifPort:      notifPort,
		bookingGen:     bookingGen,
		validationSvc:  validationSvc,
		log:            log,
	}
}

// Execute creates a new booking based on the request.
func (uc *CreateBookingUseCase) Execute(
	ctx context.Context,
	req *dto.CreateBookingRequest,
	userID *uuid.UUID,
) (*dto.CreateBookingResponse, error) {
	startTime := time.Now()

	// Validate request
	if errors := req.Validate(); len(errors) > 0 {
		return nil, fmt.Errorf("validation failed: %v", errors)
	}

	// Load flight instances
	flights, err := uc.loadFlightInstances(ctx, req.FlightIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to load flights: %w", err)
	}

	if len(flights) == 0 {
		return nil, fmt.Errorf("no valid flights found")
	}

	// Convert and validate passengers
	passengers, err := uc.convertAndValidatePassengers(ctx, req.Passengers)
	if err != nil {
		return nil, fmt.Errorf("failed to process passengers: %w", err)
	}

	// Determine cabin class
	cabinClass := uc.toCabinClass(req.CabinClass)

	// Calculate total amount
	totalAmount, err := uc.calculateTotalAmount(flights, passengers, cabinClass)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate total amount: %w", err)
	}

	// Generate booking code
	bookingCode, err := uc.bookingGen.Generate()
	if err != nil {
		return nil, fmt.Errorf("failed to generate booking code: %w", err)
	}

	// Determine trip type
	tripType := booking.TripTypeOneWay
	if len(flights) > 1 {
		tripType = booking.TripTypeRoundTrip
	}

	// Determine booking status based on payment method
	bookingStatus := booking.BookingStatusPending
	if req.PaymentMethod == "free" || req.PaymentMethod == "wallet" {
		bookingStatus = booking.BookingStatusConfirmed
	}

	// Create payment if not free
	var paymentResult *ports.PaymentResult
	paymentDeadline := time.Now().Add(15 * time.Minute)

	if bookingStatus == booking.BookingStatusPending {
		paymentResult, err = uc.paymentPort.CreatePayment(ctx, uuid.Nil, totalAmount, "VND")
		if err != nil {
			uc.log.Warn("failed to create payment", "error", err)
			// Continue without payment URL - can be retried
		} else {
			paymentDeadline = paymentResult.ExpiresAt
		}
	}

	// Build booking entity
	b := &booking.Booking{
		ID:             uuid.New(),
		BookingCode:    bookingCode,
		Status:         bookingStatus,
		TripType:       tripType,
		UserID:         userID,
		ContactEmail:   req.ContactEmail,
		ContactPhone:   req.ContactPhone,
		ContactName:    req.ContactName,
		TotalAmountVND: totalAmount,
		PaymentMethod:  req.PaymentMethod,
		BookingSource:  req.BookingSource,
		ExpiresAt:      paymentDeadline,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	// Assign passengers to booking
	for _, p := range passengers {
		p.BookingID = b.ID
		b.AddPassenger(*p)
	}

	// Assign flights to booking
	for _, f := range flights {
		bf := booking.BookingFlight{
			ID:           uuid.New(),
			BookingID:    b.ID,
			FlightID:     f.ID,
			FlightNumber: f.FlightNumber,
			OriginCode:   f.OriginCode,
			DestCode:     f.DestinationCode,
			CabinClass:   cabinClass,
			FareBasis:    "",
		}
		b.AddFlight(bf)
	}

	// Save booking with transaction
	err = uc.bookingRepo.WithTx(ctx, func(ctx context.Context) error {
		if err := uc.bookingRepo.Save(ctx, b); err != nil {
			return fmt.Errorf("failed to save booking: %w", err)
		}

		// Save passengers
		bookingPassengers := make([]booking.BookingPassenger, 0, len(passengers))
		for _, p := range passengers {
			bookingPassengers = append(bookingPassengers, *p)
		}
		if err := uc.bookingRepo.SavePassengers(ctx, bookingPassengers); err != nil {
			return fmt.Errorf("failed to save passengers: %w", err)
		}

		// Save flights
		bookingFlights := make([]booking.BookingFlight, 0, len(b.Flights))
		for _, f := range b.Flights {
			bookingFlights = append(bookingFlights, f)
		}
		if err := uc.bookingRepo.SaveFlights(ctx, bookingFlights); err != nil {
			return fmt.Errorf("failed to save flights: %w", err)
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to create booking: %w", err)
	}

	// Update flight availability
	for _, f := range flights {
		_ = uc.flightRepo.UpdateAvailability(ctx, f.ID, -len(passengers))
	}

	// Send notification (async, don't fail on error)
	if uc.notifPort != nil {
		go func() {
			emailBody := uc.buildBookingEmailBody(bookingCode, req.ContactName, flights, totalAmount)
			emailReq := ports.SendEmailRequest{
				To:          req.ContactEmail,
				Subject:     fmt.Sprintf("Booking Confirmation - %s", bookingCode),
				HTMLBody:    emailBody,
				TextBody:    emailBody,
				BookingCode: bookingCode,
			}
			_ = uc.notifPort.SendEmail(context.Background(), emailReq)
		}()
	}

	// Build response
	expiresIn := int(time.Until(paymentDeadline).Minutes())
	response := &dto.CreateBookingResponse{
		BookingCode:     bookingCode,
		Status:          string(bookingStatus),
		TotalAmountVND: totalAmount,
		PaymentDeadline: paymentDeadline,
		ExpiresIn:       expiresIn,
		Passengers:      req.Passengers,
		Flights:         uc.toFlightDTOs(flights),
	}

	if paymentResult != nil {
		response.PaymentURL = paymentResult.PaymentURL
	}

	uc.log.Info("booking created successfully",
		"booking_code", bookingCode,
		"user_id", userID,
		"total_amount", totalAmount,
		"duration_ms", time.Since(startTime).Milliseconds(),
	)

	return response, nil
}

// loadFlightInstances loads flight instances from the repository.
func (uc *CreateBookingUseCase) loadFlightInstances(ctx context.Context, flightIDs []string) ([]*flight.FlightInstance, error) {
	flights := make([]*flight.FlightInstance, 0, len(flightIDs))

	for _, idStr := range flightIDs {
		id, err := uuid.Parse(idStr)
		if err != nil {
			return nil, fmt.Errorf("invalid flight ID: %s", idStr)
		}

		f, err := uc.flightRepo.FindByID(ctx, id)
		if err != nil {
			return nil, fmt.Errorf("failed to find flight %s: %w", idStr, err)
		}

		if f.Status != flight.FlightStatusScheduled && f.Status != flight.FlightStatusOnTime {
			return nil, fmt.Errorf("flight %s is not available (status: %s)", f.FlightNumber, f.Status)
		}

		if f.SeatsAvailable <= 0 {
			return nil, fmt.Errorf("flight %s has no seats available", f.FlightNumber)
		}

		flights = append(flights, f)
	}

	return flights, nil
}

// convertAndValidatePassengers converts and validates passenger DTOs.
func (uc *CreateBookingUseCase) convertAndValidatePassengers(
	ctx context.Context,
	passengerDTOs []dto.PassengerDTO,
) ([]*booking.BookingPassenger, error) {
	passengers := make([]*booking.BookingPassenger, 0, len(passengerDTOs))

	// Validate using validation service if available
	if uc.validationSvc != nil {
		passengerInfos := make([]ports.PassengerInfo, len(passengerDTOs))
		for i, p := range passengerDTOs {
			passengerInfos[i] = ports.PassengerInfo{
				FirstName:      p.FirstName,
				LastName:       p.LastName,
				DateOfBirth:    p.DateOfBirth,
				Nationality:    p.Nationality,
				PassportNumber: p.PassportNumber,
				PassportExpiry: p.PassportExpiry,
				Type:           p.Type,
			}
		}
		if errors := uc.validationSvc.ValidatePassengers(ctx, passengerInfos); len(errors) > 0 {
			return nil, fmt.Errorf("passenger validation failed: %v", errors)
		}
	}

	// Convert DTOs to entities
	for _, pDTO := range passengerDTOs {
		p, err := pDTO.ToBookingPassenger()
		if err != nil {
			return nil, fmt.Errorf("failed to convert passenger: %w", err)
		}
		passengers = append(passengers, p)
	}

	return passengers, nil
}

// calculateTotalAmount calculates the total booking amount.
func (uc *CreateBookingUseCase) calculateTotalAmount(
	flights []*flight.FlightInstance,
	passengers []*booking.BookingPassenger,
	cabinClass valueobjects.CabinClass,
) (int64, error) {
	var total int64

	for _, f := range flights {
		// Get fare from flight or calculate
		baseFare := f.BaseFare
		if baseFare == 0 {
			baseFare = 100000 // Default fallback
		}

		// Apply cabin class multiplier
		cabinMultiplier := uc.getCabinClassMultiplier(cabinClass)
		fare := baseFare * cabinMultiplier

		// Apply passenger type multipliers
		for _, p := range passengers {
			var passengerMultiplier int64 = 100
			switch p.Type {
			case valueobjects.PassengerTypeChild:
				passengerMultiplier = 75 // 75% for children
			case valueobjects.PassengerTypeInfant:
				passengerMultiplier = 10 // 10% for infants
			}

			passengerFare := fare * passengerMultiplier / 100
			total += passengerFare
		}
	}

	// Add taxes and fees
	taxRate := int64(10) // 10% tax
	tax := total * taxRate / 100
	total += tax

	// Add service fee
	serviceFee := int64(50000) // 50,000 VND per booking
	total += serviceFee

	return total, nil
}

// getCabinClassMultiplier returns the price multiplier for a cabin class.
func (uc *CreateBookingUseCase) getCabinClassMultiplier(cabinClass valueobjects.CabinClass) int64 {
	switch cabinClass {
	case valueobjects.CabinClassEconomy:
		return 100
	case valueobjects.CabinClassPremiumEconomy:
		return 130
	case valueobjects.CabinClassBusiness:
		return 250
	case valueobjects.CabinClassFirst:
		return 400
	default:
		return 100
	}
}

// toCabinClass converts a string to CabinClass value object.
func (uc *CreateBookingUseCase) toCabinClass(cabinClassStr string) valueobjects.CabinClass {
	switch strings.ToLower(cabinClassStr) {
	case "business":
		return valueobjects.CabinClassBusiness
	case "first":
		return valueobjects.CabinClassFirst
	case "premium_economy":
		return valueobjects.CabinClassPremiumEconomy
	default:
		return valueobjects.CabinClassEconomy
	}
}

// toFlightDTOs converts flight instances to DTOs.
func (uc *CreateBookingUseCase) toFlightDTOs(flights []*flight.FlightInstance) []dto.FlightResultDTO {
	result := make([]dto.FlightResultDTO, 0, len(flights))

	for _, f := range flights {
		dto := dto.FlightResultDTO{
			ID:              f.ID,
			FlightNumber:    f.FlightNumber,
			AirlineCode:     f.AirlineCode,
			AirlineName:     f.AirlineName,
			Origin:          f.OriginCode,
			Destination:     f.DestinationCode,
			DepartureDate:   f.DepartureDate.Format("2006-01-02"),
			DepartureTime:   f.DepartureTime.Format("15:04"),
			ArrivalDate:     f.ArrivalDate.Format("2006-01-02"),
			ArrivalTime:     f.ArrivalTime.Format("15:04"),
			Duration:        f.Duration.String(),
			DurationMinutes: int(f.Duration.Minutes()),
			AircraftType:    f.AircraftType,
			Stops:           0,
			Connection:      "Direct",
			SeatsAvailable:  f.SeatsAvailable,
			Status:          string(f.Status),
			CabinClass:      string(f.CabinClass),
		}
		result = append(result, dto)
	}

	return result
}

// toBookingDetailDTO converts a booking to BookingDetailDTO.
func (uc *CreateBookingUseCase) toBookingDetailDTO(b *booking.Booking) dto.BookingDetailDTO {
	passengers := make([]dto.PassengerDetailDTO, 0, len(b.Passengers))
	for _, p := range b.Passengers {
		passengers = append(passengers, dto.PassengerDetailDTO{
			PassengerDTO: dto.PassengerDTO{
				Title:          p.Title,
				FirstName:      p.FirstName,
				LastName:       p.LastName,
				Gender:         string(p.Gender),
				DateOfBirth:    p.DateOfBirth.Format("2006-01-02"),
				Nationality:    p.Nationality,
				PassportNumber: p.PassportNumber,
				PassportExpiry: "",
				Type:           string(p.Type),
			},
			SeatNumber:   p.SeatNumber,
			TicketNumber: p.TicketNumber,
		})
	}

	flights := uc.toFlightDTOsFromBooking(b)

	return dto.BookingDetailDTO{
		BookingCode:    b.BookingCode,
		Status:         string(b.Status),
		TripType:       string(b.TripType),
		TotalAmountVND: b.TotalAmountVND,
		Contact: dto.ContactDTO{
			Email: b.ContactEmail,
			Phone: b.ContactPhone,
			Name:  b.ContactName,
		},
		Passengers: passengers,
		Flights:    flights,
		CreatedAt:  b.CreatedAt,
		UpdatedAt:  b.UpdatedAt,
	}
}

// toFlightDTOsFromBooking converts booking flights to DTOs.
func (uc *CreateBookingUseCase) toFlightDTOsFromBooking(b *booking.Booking) []dto.FlightResultDTO {
	result := make([]dto.FlightResultDTO, 0, len(b.Flights))

	for _, bf := range b.Flights {
		dto := dto.FlightResultDTO{
			ID:           bf.FlightID,
			FlightNumber: bf.FlightNumber,
			Origin:       bf.OriginCode,
			Destination:  bf.DestCode,
			CabinClass:   string(bf.CabinClass),
		}
		result = append(result, dto)
	}

	return result
}

// buildBookingEmailBody builds the HTML body for booking confirmation email.
func (uc *CreateBookingUseCase) buildBookingEmailBody(
	bookingCode string,
	contactName string,
	flights []*flight.FlightInstance,
	totalAmount int64,
) string {
	var buf bytes.Buffer

	buf.WriteString(fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Booking Confirmation</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2c3e50;">Booking Confirmation</h1>
        <p>Dear %s,</p>
        <p>Your booking has been confirmed. Here are the details:</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h2 style="margin-top: 0;">Booking Code: %s</h2>
            <p><strong>Total Amount:</strong> %d VND</p>
        </div>
        
        <h3>Flight Details</h3>
        <table style="width: 100%%; border-collapse: collapse;">
            <thead>
                <tr style="background-color: #3498db; color: white;">
                    <th style="padding: 10px; text-align: left;">Flight</th>
                    <th style="padding: 10px; text-align: left;">Route</th>
                    <th style="padding: 10px; text-align: left;">Date</th>
                </tr>
            </thead>
            <tbody>
`, contactName, bookingCode, totalAmount))

	for _, f := range flights {
		buf.WriteString(fmt.Sprintf(`
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 10px;">%s</td>
                    <td style="padding: 10px;">%s → %s</td>
                    <td style="padding: 10px;">%s</td>
                </tr>
`, f.FlightNumber, f.OriginCode, f.DestinationCode, f.DepartureDate.Format("2006-01-02")))
	}

	buf.WriteString(`
            </tbody>
        </table>
        
        <p style="margin-top: 20px;">Thank you for choosing our service!</p>
    </div>
</body>
</html>
`)

	return buf.String()
}

// ============================================================================
// Get Booking Use Case
// ============================================================================

// GetBookingUseCase handles retrieving booking details.
type GetBookingUseCase struct {
	bookingRepo ports.BookingRepositoryPort
	log        *slog.Logger
}

// NewGetBookingUseCase creates a new GetBookingUseCase.
func NewGetBookingUseCase(
	bookingRepo ports.BookingRepositoryPort,
	log *slog.Logger,
) *GetBookingUseCase {
	return &GetBookingUseCase{
		bookingRepo: bookingRepo,
		log:        log,
	}
}

// Execute retrieves booking details by booking code.
func (uc *GetBookingUseCase) Execute(
	ctx context.Context,
	bookingCode string,
	userID *uuid.UUID,
) (*dto.BookingDetailDTO, error) {
	// Find booking by code
	b, err := uc.bookingRepo.FindByCode(ctx, bookingCode)
	if err != nil {
		uc.log.Warn("booking not found", "booking_code", bookingCode, "error", err)
		return nil, fmt.Errorf("booking not found: %s", bookingCode)
	}

	// Check access - user can only see their own bookings
	if userID != nil && b.UserID != nil && *userID != *b.UserID {
		uc.log.Warn("unauthorized booking access attempt",
			"booking_code", bookingCode,
			"user_id", userID,
			"owner_id", b.UserID,
		)
		return nil, fmt.Errorf("unauthorized access to booking")
	}

	// Build response
	response := &dto.BookingDetailDTO{
		BookingCode:    b.BookingCode,
		Status:         string(b.Status),
		TripType:       string(b.TripType),
		TotalAmountVND: b.TotalAmountVND,
		Contact: dto.ContactDTO{
			Email: b.ContactEmail,
			Phone: b.ContactPhone,
			Name:  b.ContactName,
		},
		CreatedAt: b.CreatedAt,
		UpdatedAt: b.UpdatedAt,
	}

	// Convert passengers
	passengers := make([]dto.PassengerDetailDTO, 0, len(b.Passengers))
	for _, p := range b.Passengers {
		dobStr := ""
		if !p.DateOfBirth.IsZero() {
			dobStr = p.DateOfBirth.Format("2006-01-02")
		}

		passengers = append(passengers, dto.PassengerDetailDTO{
			PassengerDTO: dto.PassengerDTO{
				Title:          p.Title,
				FirstName:      p.FirstName,
				LastName:       p.LastName,
				Gender:         string(p.Gender),
				DateOfBirth:    dobStr,
				Nationality:    p.Nationality,
				PassportNumber: p.PassportNumber,
				Type:           string(p.Type),
			},
			SeatNumber:   p.SeatNumber,
			TicketNumber: p.TicketNumber,
		})
	}
	response.Passengers = passengers

	// Convert flights
	flights := make([]dto.FlightResultDTO, 0, len(b.Flights))
	for _, bf := range b.Flights {
		flights = append(flights, dto.FlightResultDTO{
			ID:           bf.FlightID,
			FlightNumber: bf.FlightNumber,
			Origin:       bf.OriginCode,
			Destination:  bf.DestCode,
			CabinClass:   string(bf.CabinClass),
		})
	}
	response.Flights = flights

	// Add price breakdown
	response.Price = dto.PriceDTO{
		TotalVND: b.TotalAmountVND,
		Currency: "VND",
	}

	uc.log.Info("booking retrieved successfully",
		"booking_code", bookingCode,
		"status", b.Status,
	)

	return response, nil
}

// ============================================================================
// Cancel Booking Use Case
// ============================================================================

// CancelBookingUseCase handles booking cancellation.
type CancelBookingUseCase struct {
	bookingRepo  ports.BookingRepositoryPort
	flightRepo   ports.FlightRepositoryPort
	paymentPort  ports.PaymentPort
	notifPort    ports.NotificationPort
	auditPort    ports.AuditPort
	log          *slog.Logger
}

// NewCancelBookingUseCase creates a new CancelBookingUseCase.
func NewCancelBookingUseCase(
	bookingRepo ports.BookingRepositoryPort,
	flightRepo ports.FlightRepositoryPort,
	paymentPort ports.PaymentPort,
	notifPort ports.NotificationPort,
	auditPort ports.AuditPort,
	log *slog.Logger,
) *CancelBookingUseCase {
	return &CancelBookingUseCase{
		bookingRepo: bookingRepo,
		flightRepo:  flightRepo,
		paymentPort: paymentPort,
		notifPort:   notifPort,
		auditPort:   auditPort,
		log:         log,
	}
}

// Execute cancels a booking.
func (uc *CancelBookingUseCase) Execute(
	ctx context.Context,
	req *dto.CancelBookingRequest,
	userID *uuid.UUID,
) (*dto.CancelBookingResponse, error) {
	// Find booking
	b, err := uc.bookingRepo.FindByCode(ctx, req.BookingCode)
	if err != nil {
		return nil, fmt.Errorf("booking not found: %s", req.BookingCode)
	}

	// Check if booking can be cancelled
	if b.Status == booking.BookingStatusCancelled {
		return nil, fmt.Errorf("booking is already cancelled")
	}

	if b.Status == booking.BookingStatusCompleted {
		return nil, fmt.Errorf("completed bookings cannot be cancelled")
	}

	// Check authorization
	if userID != nil && b.UserID != nil && *userID != *b.UserID {
		return nil, fmt.Errorf("unauthorized to cancel this booking")
	}

	// Calculate refund amount (simplified - no refund for non-refundable fares)
	var refundAmount int64
	if b.Status == booking.BookingStatusConfirmed {
		refundAmount = b.TotalAmountVND // Full refund for confirmed bookings
	}

	// Process refund if applicable
	if refundAmount > 0 && b.PaymentTxnID != "" {
		err = uc.paymentPort.RefundPayment(ctx, b.PaymentTxnID, refundAmount)
		if err != nil {
			uc.log.Warn("failed to process refund", "error", err)
			// Continue with cancellation even if refund fails
		}
	}

	// Update booking status
	err = uc.bookingRepo.UpdateStatus(ctx, b.ID, booking.BookingStatusCancelled)
	if err != nil {
		return nil, fmt.Errorf("failed to cancel booking: %w", err)
	}

	// Restore flight availability
	for _, bf := range b.Flights {
		_ = uc.flightRepo.UpdateAvailability(ctx, bf.FlightID, len(b.Passengers))
	}

	// Log audit
	if uc.auditPort != nil {
		auditLog := &ports.AuditLog{
			ID:         uuid.New(),
			Timestamp:  time.Now(),
			UserID:     uuid.Nil,
			Action:     "CANCEL_BOOKING",
			EntityType: "booking",
			EntityID:   b.ID,
			Details:    fmt.Sprintf("reason: %s, cancelled_by: %s", req.Reason, req.CancelledBy),
		}
		_ = uc.auditPort.Log(ctx, auditLog)
	}

	// Send notification
	if uc.notifPort != nil {
		go func() {
			emailReq := ports.SendEmailRequest{
				To:      b.ContactEmail,
				Subject: fmt.Sprintf("Booking Cancelled - %s", b.BookingCode),
				TextBody: fmt.Sprintf(
					"Your booking %s has been cancelled. Refund amount: %d VND",
					b.BookingCode, refundAmount,
				),
				BookingCode: b.BookingCode,
			}
			_ = uc.notifPort.SendEmail(context.Background(), emailReq)
		}()
	}

	uc.log.Info("booking cancelled",
		"booking_code", req.BookingCode,
		"refund_amount", refundAmount,
		"cancelled_by", req.CancelledBy,
	)

	return &dto.CancelBookingResponse{
		BookingCode:     req.BookingCode,
		Status:          string(booking.BookingStatusCancelled),
		RefundAmountVND: refundAmount,
	}, nil
}

// ============================================================================
// List User Bookings Use Case
// ============================================================================

// ListUserBookingsUseCase handles listing user's bookings.
type ListUserBookingsUseCase struct {
	bookingRepo ports.BookingRepositoryPort
	log         *slog.Logger
}

// NewListUserBookingsUseCase creates a new ListUserBookingsUseCase.
func NewListUserBookingsUseCase(
	bookingRepo ports.BookingRepositoryPort,
	log *slog.Logger,
) *ListUserBookingsUseCase {
	return &ListUserBookingsUseCase{
		bookingRepo: bookingRepo,
		log:         log,
	}
}

// Execute lists bookings for a user with pagination.
func (uc *ListUserBookingsUseCase) Execute(
	ctx context.Context,
	userID uuid.UUID,
	page, pageSize int,
) (*dto.PaginatedResponse, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	if pageSize > 100 {
		pageSize = 100
	}

	bookings, totalCount, err := uc.bookingRepo.FindByUser(ctx, userID, page, pageSize)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve bookings: %w", err)
	}

	// Convert to DTOs
	bookingDTOs := make([]dto.BookingDetailDTO, 0, len(bookings))
	for _, b := range bookings {
		bookingDTOs = append(bookingDTOs, dto.BookingDetailDTO{
			BookingCode:    b.BookingCode,
			Status:         string(b.Status),
			TripType:       string(b.TripType),
			TotalAmountVND: b.TotalAmountVND,
			CreatedAt:      b.CreatedAt,
		})
	}

	return dto.NewPaginatedResponse(bookingDTOs, page, pageSize, totalCount), nil
}
