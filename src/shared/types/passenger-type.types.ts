/**
 * Passenger Type Validation Types
 * 
 * Type definitions for passenger type validation utilities
 */

import { PassengerType } from '../constants/enums';

export interface PassengerValidationResult {
	valid: boolean;
	errors: string[];
}

export interface PassengerValidationInput {
	dob: Date;
	passengerType: PassengerType;
}

