import { PassengerType } from '../constants/enums';

/**
 * Calculate age in years from date of birth to a specific date
 * @param dob Date of birth
 * @param referenceDate Reference date (default: today). Usually the flight departure date
 * @returns Age in years
 */
export function calculateAge(dob: Date, referenceDate: Date = new Date()): number {
	const today = new Date(referenceDate);
	const birthDate = new Date(dob);
	
	let age = today.getFullYear() - birthDate.getFullYear();
	const monthDiff = today.getMonth() - birthDate.getMonth();
	
	if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
		age--;
	}
	
	return age;
}

/**
 * Determine passenger type based on age at flight date
 * - INF: Under 2 years old (has not reached 2nd birthday)
 * - CHD: 2 to under 12 years old (has reached 2nd birthday but not 12th birthday)
 * - ADT: 12 years old and above (has reached 12th birthday)
 * 
 * @param dob Date of birth
 * @param flightDate Flight departure date (reference date for age calculation)
 * @returns PassengerType
 */
export function determinePassengerType(dob: Date, flightDate: Date): PassengerType {
	const age = calculateAge(dob, flightDate);
	
	if (age < 2) {
		return PassengerType.INF;
	} else if (age < 12) {
		return PassengerType.CHD;
	} else {
		return PassengerType.ADT;
	}
}

/**
 * Check if a passenger is an adult (18+ years old) at flight date
 * Used to validate if an adult can accompany an infant
 * 
 * @param dob Date of birth
 * @param flightDate Flight departure date
 * @returns true if passenger is 18 or older
 */
export function isAdult(dob: Date, flightDate: Date): boolean {
	const age = calculateAge(dob, flightDate);
	return age >= 18;
}

/**
 * Validate passenger type assignment
 * - INF must be accompanied by at least one ADT (18+)
 * - Each ADT can accompany maximum 1 INF
 * - If more than 1 INF per ADT, additional INF must be converted to CHD
 * 
 * @param passengers Array of { dob: Date, passengerType: PassengerType }
 * @param flightDate Flight departure date
 * @returns { valid: boolean, errors: string[] }
 */
export function validatePassengerTypes(
	passengers: Array<{ dob: Date; passengerType: PassengerType }>,
	flightDate: Date
): { valid: boolean; errors: string[] } {
	const errors: string[] = [];
	
	// Count passengers by type
	const adults = passengers.filter(p => p.passengerType === PassengerType.ADT);
	const infants = passengers.filter(p => p.passengerType === PassengerType.INF);
	const children = passengers.filter(p => p.passengerType === PassengerType.CHD);
	
	// Check if all ADT are actually adults (18+)
	const invalidAdults = adults.filter(p => !isAdult(p.dob, flightDate));
	if (invalidAdults.length > 0) {
		errors.push('Some passengers marked as ADT are not 18 years or older');
	}
	
	// Check INF requirements
	if (infants.length > 0) {
		// Each INF must have at least one ADT (18+) to accompany
		if (adults.length === 0) {
			errors.push('Infants (INF) must be accompanied by at least one adult (ADT)');
		}
		
		// Each ADT can only accompany maximum 1 INF
		if (infants.length > adults.length) {
			errors.push(`Each adult can only accompany maximum 1 infant. You have ${adults.length} adult(s) but ${infants.length} infant(s). Additional infant(s) must be booked as child (CHD).`);
		}
	}
	
	// Validate that passenger types match their actual age
	for (const passenger of passengers) {
		const actualType = determinePassengerType(passenger.dob, flightDate);
		if (passenger.passengerType !== actualType) {
			// Special case: INF can be converted to CHD if there are too many INF per ADT
			// But we should warn the user
			if (passenger.passengerType === PassengerType.INF && actualType === PassengerType.CHD) {
				errors.push(`Passenger ${passenger.dob.toISOString()} is 2 years or older and should be booked as CHD, not INF`);
			} else if (passenger.passengerType !== actualType) {
				errors.push(`Passenger type mismatch: Expected ${actualType} but got ${passenger.passengerType} for age ${calculateAge(passenger.dob, flightDate)}`);
			}
		}
	}
	
	return {
		valid: errors.length === 0,
		errors,
	};
}

