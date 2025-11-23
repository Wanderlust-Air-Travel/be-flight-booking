/**
 * Types and interfaces for booking state management
 * Separated from business logic for better code organization
 */

export interface CabinSelection {
	flightInstanceId: string;
	cabinType: 'economy' | 'business';
	fareClassCode: string;
}

export interface SeatSelection {
	flightInstanceId: string;
	flightSeatId: string;
	seatNumber: string;
}

export interface BookingState {
	flightInstanceId: string;
	cabin?: CabinSelection;
	seat?: SeatSelection;
	updatedAt: Date;
}

