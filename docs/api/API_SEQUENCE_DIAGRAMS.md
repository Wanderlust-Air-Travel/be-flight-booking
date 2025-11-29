# API Sequence Diagrams

## Booking Flow with Auto-fetch Cabin Type

### Flow: Search → Select Cabin → View Seat Map (Auto-fetch)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API Gateway
    participant Booking State Service
    participant Redis
    participant Search Microservice

    User->>Frontend: Search flights
    Frontend->>API Gateway: GET /api/v1/search/flights
    API Gateway->>Search Microservice: Search flights
    Search Microservice-->>API Gateway: Flight results
    API Gateway-->>Frontend: Flight results
    Frontend-->>User: Display flights

    User->>Frontend: Select cabin & fare class
    Frontend->>API Gateway: POST /api/v1/booking-state/cabin
    Note over Frontend,API Gateway: {flightInstanceId, cabinType, fareClassCode}
    API Gateway->>Booking State Service: Save cabin selection
    Booking State Service->>Redis: SET booking:state:{userId}:{flightInstanceId}:cabin
    Redis-->>Booking State Service: OK
    Booking State Service-->>API Gateway: Success
    API Gateway-->>Frontend: {success: true}

    User->>Frontend: View seat map
    Frontend->>API Gateway: GET /api/v1/search/seats?flightInstanceId=xxx
    Note over Frontend,API Gateway: No cabinType in query (auto-fetch)
    API Gateway->>Booking State Service: Get cabin selection
    Booking State Service->>Redis: GET booking:state:{userId}:{flightInstanceId}:cabin
    Redis-->>Booking State Service: {cabinType: "economy"}
    Booking State Service-->>API Gateway: cabinType
    API Gateway->>Search Microservice: Get seat map (with cabinType)
    Search Microservice-->>API Gateway: Seat map data
    API Gateway-->>Frontend: Seat map
    Frontend-->>User: Display seat map
```

## Deals Images Download Flow

### Flow: Docker Startup → Download Deals Images

```mermaid
sequenceDiagram
    participant Docker
    participant Entrypoint Script
    participant Backend Services
    participant API Gateway
    participant Services Microservice
    participant Download Script
    participant Lorem Picsum

    Docker->>Entrypoint Script: Start container
    Entrypoint Script->>Backend Services: npm run start:all
    Backend Services->>API Gateway: Start services
    API Gateway->>API Gateway: Health check endpoint ready

    Entrypoint Script->>Entrypoint Script: Wait for API Gateway
    loop Health Check Retry
        Entrypoint Script->>API Gateway: GET /api/v1/health
        API Gateway-->>Entrypoint Script: 200 OK (when ready)
    end

    Entrypoint Script->>Download Script: Run download:deals-images
    Download Script->>Download Script: Delete old images
    Download Script->>API Gateway: GET /api/v1/services/deals
    API Gateway->>Services Microservice: Get deals
    Services Microservice-->>API Gateway: Top 8 deals
    API Gateway-->>Download Script: Deals data

    loop For each deal (top 8)
        Download Script->>Lorem Picsum: GET /{width}/{height}?random={routeId}
        Lorem Picsum-->>Download Script: Image data
        Download Script->>Download Script: Save {routeId}.jpg
    end

    Download Script-->>Entrypoint Script: Complete
```

## Conditional Database Seeding Flow

### Flow: Check Data → Seed if Empty

```mermaid
sequenceDiagram
    participant Docker
    participant Seed Script
    participant Database
    participant Seed Full Script

    Docker->>Seed Script: npm run seed:if-empty
    Seed Script->>Database: SELECT COUNT(*) FROM dbo.Users
    Database-->>Seed Script: User count
    Seed Script->>Database: SELECT COUNT(*) FROM dbo.Routes
    Database-->>Seed Script: Route count
    Seed Script->>Database: SELECT COUNT(*) FROM dbo.FlightSchedules
    Database-->>Seed Script: Schedule count
    Seed Script->>Database: SELECT COUNT(*) FROM dbo.FlightInstances
    Database-->>Seed Script: Instance count

    alt Data Exists
        Seed Script->>Seed Script: Log existing data info
        Seed Script-->>Docker: Exit 0 (skip seeding)
    else No Data
        Seed Script->>Seed Full Script: npm run seed:full
        Seed Full Script->>Database: Seed all data
        Database-->>Seed Full Script: Success
        Seed Full Script-->>Seed Script: Complete
        Seed Script-->>Docker: Exit 0
    end
```

## Seat Map Auto-fetch Flow

### Flow: Get Seat Map with Auto-fetch Cabin Type

```mermaid
sequenceDiagram
    participant Frontend
    participant API Gateway
    participant OptionalJwtAuthGuard
    participant Booking State Service
    participant Redis
    participant Search Microservice

    Frontend->>API Gateway: GET /api/v1/search/seats?flightInstanceId=xxx
    Note over Frontend,API Gateway: No cabinType in query

    API Gateway->>OptionalJwtAuthGuard: Extract user from JWT
    alt User Authenticated
        OptionalJwtAuthGuard-->>API Gateway: {userId}
        API Gateway->>Booking State Service: Get cabin selection
        Booking State Service->>Redis: GET booking:state:{userId}:{flightInstanceId}:cabin
        alt Cabin Selection Exists
            Redis-->>Booking State Service: {cabinType: "economy"}
            Booking State Service-->>API Gateway: cabinType
            API Gateway->>Search Microservice: Get seat map (cabinType=economy)
            Search Microservice-->>API Gateway: Seat map
            API Gateway-->>Frontend: Seat map
        else No Cabin Selection
            Booking State Service-->>API Gateway: null
            API Gateway-->>Frontend: 400 Bad Request (cabinType required)
        end
    else User Not Authenticated
        OptionalJwtAuthGuard-->>API Gateway: null
        API Gateway-->>Frontend: 400 Bad Request (cabinType required)
    end
```

## Guest Booking Flow

### Flow: Guest User Creates Booking (No Authentication Required)

```mermaid
sequenceDiagram
    participant Guest
    participant Frontend
    participant API Gateway
    participant OptionalJwtAuthGuard
    participant Reservation MS
    participant Booking MS
    participant Payment MS
    participant Email MS
    participant Database

    Note over Guest,Database: Guest Booking Flow (No Login Required)

    Guest->>Frontend: Search flights
    Frontend->>API Gateway: GET /api/v1/search/flights
    API Gateway-->>Frontend: Flight results
    Frontend-->>Guest: Display flights

    Guest->>Frontend: Select flight & cabin
    Note over Guest,Frontend: Guest must login to save booking state
    Frontend->>API Gateway: POST /api/v1/booking-state/cabin
    Note over Frontend,API Gateway: Requires authentication
    API Gateway-->>Frontend: 401 Unauthorized (or guest logs in)

    alt Guest Logs In
        Guest->>Frontend: Login
        Frontend->>API Gateway: POST /api/v1/auth/login
        API Gateway-->>Frontend: {access_token}
        Frontend->>API Gateway: POST /api/v1/booking-state/cabin
        Note over Frontend,API Gateway: With Authorization header
        API Gateway-->>Frontend: Success
    end

    Guest->>Frontend: Select seat
    Frontend->>API Gateway: POST /api/v1/booking-state/seat
    Note over Frontend,API Gateway: With Authorization header
    API Gateway-->>Frontend: Success

    Guest->>Frontend: Create reservation
    Frontend->>API Gateway: POST /api/v1/reservations
    Note over Frontend,API Gateway: Optional auth - no token
    API Gateway->>OptionalJwtAuthGuard: Extract user from JWT
    OptionalJwtAuthGuard-->>API Gateway: null (no user)
    API Gateway->>Reservation MS: Create reservation (userId=null)
    Reservation MS->>Database: Save reservation (user_id=null)
    Reservation MS-->>API Gateway: {reservationId, reservationCode}
    API Gateway-->>Frontend: Reservation created

    Guest->>Frontend: Fill passenger & contact info
    Note over Guest,Frontend: Contact info REQUIRED for guest
    Guest->>Frontend: Submit booking form
    Frontend->>API Gateway: POST /api/v1/bookings?reservationId=xxx
    Note over Frontend,API Gateway: Optional auth - no token, contact info required
    API Gateway->>OptionalJwtAuthGuard: Extract user from JWT
    OptionalJwtAuthGuard-->>API Gateway: null (no user)
    API Gateway->>Booking MS: Create booking (userId=null, contact info required)
    Booking MS->>Database: Create booking (user_id=null)
    Booking MS->>Database: Create passengers (user_id=null)
    Booking MS->>Database: Create booking segments
    Booking MS-->>API Gateway: {bookingId, pnrCode}
    API Gateway-->>Frontend: Booking created

    Guest->>Frontend: Process payment
    Frontend->>API Gateway: POST /api/v1/payments/bookings/:bookingId/process
    Note over Frontend,API Gateway: Optional auth
    API Gateway->>Payment MS: Process payment
    Payment MS->>Database: Create payment
    Payment MS->>Database: Update booking status = 'paid'
    Payment MS->>Booking MS: Create tickets from booking
    Booking MS->>Database: Create tickets
    Booking MS->>Email MS: Send ticket confirmation email
    Email MS-->>Guest: Email with ticket details
    Payment MS-->>API Gateway: Payment success
    API Gateway-->>Frontend: Payment completed
    Frontend-->>Guest: Booking confirmed
```

## Authenticated Booking Flow

### Flow: Authenticated User Creates Booking

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API Gateway
    participant OptionalJwtAuthGuard
    participant Reservation MS
    participant Booking MS
    participant Payment MS
    participant Email MS
    participant Database

    Note over User,Database: Authenticated Booking Flow

    User->>Frontend: Search flights (logged in)
    Frontend->>API Gateway: GET /api/v1/search/flights
    API Gateway-->>Frontend: Flight results

    User->>Frontend: Select cabin
    Frontend->>API Gateway: POST /api/v1/booking-state/cabin
    Note over Frontend,API Gateway: With Authorization: Bearer token
    API Gateway->>OptionalJwtAuthGuard: Validate JWT
    OptionalJwtAuthGuard-->>API Gateway: {userId}
    API Gateway-->>Frontend: Success

    User->>Frontend: Select seat
    Frontend->>API Gateway: POST /api/v1/booking-state/seat
    Note over Frontend,API Gateway: With Authorization: Bearer token
    API Gateway-->>Frontend: Success

    User->>Frontend: Create reservation
    Frontend->>API Gateway: POST /api/v1/reservations
    Note over Frontend,API Gateway: With Authorization: Bearer token
    API Gateway->>OptionalJwtAuthGuard: Extract user from JWT
    OptionalJwtAuthGuard-->>API Gateway: {userId}
    API Gateway->>Reservation MS: Create reservation (userId)
    Reservation MS->>Database: Save reservation (user_id)
    Reservation MS-->>API Gateway: {reservationId}
    API Gateway-->>Frontend: Reservation created

    User->>Frontend: Fill passenger info (contact optional)
    Note over User,Frontend: Contact info optional - will use user info
    User->>Frontend: Submit booking form
    Frontend->>API Gateway: POST /api/v1/bookings?reservationId=xxx
    Note over Frontend,API Gateway: With Authorization: Bearer token
    API Gateway->>OptionalJwtAuthGuard: Extract user from JWT
    OptionalJwtAuthGuard-->>API Gateway: {userId}
    API Gateway->>Booking MS: Create booking (userId, contact info optional)
    Booking MS->>Database: Get user info
    Booking MS->>Database: Create booking (user_id)
    Booking MS->>Database: Create/reuse passengers (user_id)
    Booking MS->>Database: Create booking segments
    Booking MS-->>API Gateway: {bookingId, pnrCode}
    API Gateway-->>Frontend: Booking created

    User->>Frontend: Process payment
    Frontend->>API Gateway: POST /api/v1/payments/bookings/:bookingId/process
    Note over Frontend,API Gateway: With Authorization: Bearer token (optional for guest)
    API Gateway->>Payment MS: Process payment
    Payment MS->>Database: Create payment
    Payment MS->>Database: Update booking status = 'paid'
    
    Note over Payment MS,RabbitMQ: Async processing via RabbitMQ
    Payment MS->>RabbitMQ: Publish ticket creation message
    Payment MS->>RabbitMQ: Publish email notification
    Payment MS-->>API Gateway: Payment success (non-blocking)
    API Gateway-->>Frontend: Payment completed
    
    RabbitMQ->>Booking MS: Consume ticket creation message
    Booking MS->>Database: Create tickets
    
    RabbitMQ->>Email MS: Consume email notification
    Email MS-->>User: Email with ticket details (async)
    
    Frontend-->>User: Booking confirmed
```

## Payment Flow with RabbitMQ (Async Processing)

### Flow: Payment Processing with RabbitMQ Integration

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API Gateway
    participant Payment MS
    participant RabbitMQ
    participant Booking MS
    participant Email MS
    participant Database

    User->>Frontend: Click "Pay Now"
    Frontend->>API Gateway: POST /api/v1/payments/bookings/:bookingId/process
    Note over Frontend,API Gateway: Optional auth (guest/authenticated)
    
    API Gateway->>Payment MS: Process payment (userId or null)
    Payment MS->>Database: Begin transaction
    Payment MS->>Database: Create payment record
    Payment MS->>Database: Update booking status = 'paid'
    Payment MS->>Database: Commit transaction
    
    Note over Payment MS,RabbitMQ: Async processing (non-blocking)
    Payment MS->>RabbitMQ: Publish ticket creation message
    Note over Payment MS,RabbitMQ: Queue: ticket_creation
    Payment MS->>RabbitMQ: Publish email notification
    Note over Payment MS,RabbitMQ: Queue: email_notifications
    
    Payment MS-->>API Gateway: Payment success (immediate response)
    API Gateway-->>Frontend: {paymentId, status: 'success'}
    Frontend-->>User: Payment successful
    
    Note over RabbitMQ,Booking MS: Background processing
    RabbitMQ->>Booking MS: Consume ticket creation message
    Booking MS->>Database: Create tickets from booking
    Booking MS->>Database: Update ticket status
    
    Note over RabbitMQ,Email MS: Background processing
    RabbitMQ->>Email MS: Consume email notification
    Email MS->>Email MS: Render email template
    Email MS->>Email MS: Send via Gmail API
    Email MS-->>User: Ticket confirmation email (async)
    
    Note over User,Database: Benefits: Non-blocking, better performance, scalability
```

## Payment Flow - Already Paid Handling

### Flow: Payment Attempt for Already Paid Booking

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API Gateway
    participant Payment MS
    participant Database

    User->>Frontend: Click "Pay Now" (booking already paid)
    Frontend->>API Gateway: POST /api/v1/payments/bookings/:bookingId/process
    
    API Gateway->>Payment MS: Process payment
    Payment MS->>Database: Check booking status
    Database-->>Payment MS: Booking status = 'paid'
    
    Payment MS-->>API Gateway: Error: "Booking is already paid"
    API Gateway-->>Frontend: 400 Bad Request
    
    Note over Frontend: Smart error handling
    Frontend->>Frontend: Detect "already paid" error
    Frontend->>Frontend: Set status = "success"
    Frontend->>Frontend: Show message: "Already paid, redirecting..."
    Frontend->>Frontend: Redirect to confirmation page
    
    Frontend-->>User: Redirected to confirmation page
```