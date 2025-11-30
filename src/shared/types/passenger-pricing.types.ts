/**
 * Passenger Pricing Types
 * 
 * Type definitions for passenger pricing service
 */

export interface PassengerFareDetails {
	baseFare: number;
	taxAmount: number;
	feeAmount: number;
	totalAmount: number;
}

