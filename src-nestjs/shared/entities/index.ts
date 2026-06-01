/**
 * Shared Entities - Database models used across all services
 * 
 * All entities are exported from this central location to ensure
 * consistent imports across API Gateway and Microservices
 */

// User & Auth
export * from './user/user.entity';
export * from './passenger/passenger.entity';

// Aircraft & Airport
export * from './aircraft/aircraft.entity';
export * from './aircraft/aircraft-type.entity';
export * from './airport/airport.entity';

// Flight & Route
export * from './route/route.entity';
export * from './flight/flight-schedule.entity';
export * from './flight/flight-instance.entity';
export * from './flight/flight-seat.entity';

// Seat & Cabin
export * from './seat/seat-configuration.entity';
export * from './cabin/cabin-class.entity';

// Booking & Ticket
export * from './booking/booking.entity';
export * from './booking/booking-segment.entity';
export * from './booking/booking-passenger.entity';
export * from './ticket/ticket.entity';

// Reservation
export * from './reservation/reservation.entity';

// Payment & Fare
export * from './payment/payment.entity';
export * from './payment/payment-method.entity';
export * from './fare/fare-class.entity';
export * from './currency/currency.entity';