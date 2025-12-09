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

export interface SeatSelectionItem {
	flightSeatId: string;
	seatNumber: string;
}

export interface SelectedCabinService {
	cabinServiceId: string;
	serviceType: string;
	serviceName: string;
	price: number | null;
	isIncluded: boolean;
}

export interface BookingState {
	flightInstanceId: string;
	cabin?: CabinSelection;
	seat?: SeatSelection; // Deprecated: use seats instead for multiple seats
	seats?: SeatSelectionItem[]; // Array of seat selections for multiple passengers
	selectedServices?: SelectedCabinService[]; // Array of selected cabin services
	updatedAt: Date;
}

