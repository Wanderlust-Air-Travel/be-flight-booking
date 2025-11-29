import { Injectable, Logger } from '@nestjs/common';
import { BookingStateRepository } from '../repositories/booking-state.repository';
import { CabinSelection, SeatSelection, BookingState } from '../types/booking-state.types';
import {
	BookingStateNotFoundException,
	CabinNotSelectedException,
	SeatNotSelectedException,
	InvalidFareClassException,
} from '../exceptions/booking-state.exceptions';
import { SessionHelper } from '../utils/session-helper';

/**
 * Service for managing booking state (cabin and seat selections)
 * Follows Service Layer Pattern - contains business logic
 * Uses Repository Pattern for data access
 */
@Injectable()
export class BookingStateService {
	private readonly logger = new Logger(BookingStateService.name);

	constructor(private readonly bookingStateRepository: BookingStateRepository) {}

	/**
	 * Save cabin selection to Redis
	 * Business logic: Validates fare class matches cabin type, then updates or creates booking state
	 * 
	 * @param identifier - User ID (authenticated) or session ID (guest)
	 * @param cabinSelection - Cabin selection data
	 * @param isGuest - Whether this is a guest session
	 * @returns Success response
	 * @throws InvalidFareClassException if fare class code doesn't match cabin type
	 */
	async saveCabinSelection(
		identifier: string,
		cabinSelection: CabinSelection,
		isGuest: boolean = false,
	): Promise<{ success: boolean; message: string }> {
		this.logger.log(`Saving cabin selection for ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${cabinSelection.flightInstanceId}`);

		// Business rule: Validate fare class code matches cabin type
		// Economy fare classes start with 'Y' (e.g., 'YS', 'YF', 'YSM')
		// Business fare classes start with 'J' (e.g., 'JS', 'JF', 'JFLX')
		const fareClassCode = cabinSelection.fareClassCode.toUpperCase();
		const expectedPrefix = cabinSelection.cabinType === 'economy' ? 'Y' : 'J';
		
		if (!fareClassCode.startsWith(expectedPrefix)) {
			this.logger.warn(
				`Invalid fare class code '${fareClassCode}' for cabin type '${cabinSelection.cabinType}' for ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${cabinSelection.flightInstanceId}`
			);
			throw new InvalidFareClassException(fareClassCode, cabinSelection.cabinType);
		}

		// Get existing state or create new
		let state = await this.bookingStateRepository.findOne(identifier, cabinSelection.flightInstanceId, isGuest);
		
		if (!state) {
			state = {
				flightInstanceId: cabinSelection.flightInstanceId,
				updatedAt: new Date(),
			};
		}

		// Update cabin selection (overwrites existing if any)
		state.cabin = cabinSelection;
		state.updatedAt = new Date();

		// Save to Redis via repository
		await this.bookingStateRepository.save(identifier, cabinSelection.flightInstanceId, state, isGuest);

		this.logger.log(`Cabin selection saved successfully for ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${cabinSelection.flightInstanceId}`);
		
		return {
			success: true,
			message: 'Cabin selection saved successfully',
		};
	}

	/**
	 * Save seat selection to Redis
	 * Business logic: Validates cabin is selected first, then updates seat selection
	 * 
	 * @param identifier - User ID (authenticated) or session ID (guest)
	 * @param seatSelection - Seat selection data
	 * @param isGuest - Whether this is a guest session
	 * @returns Success response
	 * @throws CabinNotSelectedException if cabin is not selected
	 */
	async saveSeatSelection(
		identifier: string,
		seatSelection: SeatSelection,
		isGuest: boolean = false,
	): Promise<{ success: boolean; message: string }> {
		this.logger.log(`Saving seat selection for ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${seatSelection.flightInstanceId}`);

		// Get existing state or create new
		let state = await this.bookingStateRepository.findOne(identifier, seatSelection.flightInstanceId, isGuest);
		
		if (!state) {
			state = {
				flightInstanceId: seatSelection.flightInstanceId,
				updatedAt: new Date(),
			};
		}

		// Business rule: Cabin must be selected before seat
		if (!state.cabin) {
			this.logger.warn(`Attempted to save seat without cabin for ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${seatSelection.flightInstanceId}`);
			throw new CabinNotSelectedException(seatSelection.flightInstanceId);
		}

		// Update seat selection
		state.seat = seatSelection;
		state.updatedAt = new Date();

		// Save to Redis via repository
		await this.bookingStateRepository.save(identifier, seatSelection.flightInstanceId, state, isGuest);

		this.logger.log(`Seat selection saved successfully for ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${seatSelection.flightInstanceId}`);
		
		return {
			success: true,
			message: 'Seat selection saved successfully',
		};
	}

	/**
	 * Get current booking state from Redis
	 * 
	 * @param identifier - User ID (authenticated) or session ID (guest)
	 * @param flightInstanceId - Flight instance ID
	 * @param isGuest - Whether this is a guest session
	 * @returns BookingState or null if not found
	 */
	async getBookingState(identifier: string, flightInstanceId: string, isGuest: boolean = false): Promise<BookingState | null> {
		return await this.bookingStateRepository.findOne(identifier, flightInstanceId, isGuest);
	}

	/**
	 * Get cabin and seat selection for creating reservation
	 * Business logic: Validates both cabin and seat are selected
	 * 
	 * @param identifier - User ID (authenticated) or session ID (guest)
	 * @param flightInstanceId - Flight instance ID
	 * @param isGuest - Whether this is a guest session
	 * @returns Cabin and seat selections
	 * @throws BookingStateNotFoundException if state not found
	 * @throws CabinNotSelectedException if cabin not selected
	 * @throws SeatNotSelectedException if seat not selected
	 */
	async getSelectionsForReservation(
		identifier: string,
		flightInstanceId: string,
		isGuest: boolean = false,
	): Promise<{ cabin: CabinSelection; seat: SeatSelection }> {
		this.logger.log(`Getting selections for reservation: ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${flightInstanceId}`);

		const state = await this.getBookingState(identifier, flightInstanceId, isGuest);
		
		if (!state) {
			this.logger.warn(`Booking state not found for ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${flightInstanceId}`);
			throw new BookingStateNotFoundException(flightInstanceId);
		}

		if (!state.cabin) {
			this.logger.warn(`Cabin not selected for ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${flightInstanceId}`);
			throw new CabinNotSelectedException(flightInstanceId);
		}

		if (!state.seat) {
			this.logger.warn(`Seat not selected for ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${flightInstanceId}`);
			throw new SeatNotSelectedException(flightInstanceId);
		}

		this.logger.log(`Selections retrieved successfully for ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${flightInstanceId}`);
		
		return {
			cabin: state.cabin,
			seat: state.seat,
		};
	}

	/**
	 * Clear booking state (after successful reservation or cancellation)
	 * 
	 * @param identifier - User ID (authenticated) or session ID (guest)
	 * @param flightInstanceId - Flight instance ID
	 * @param isGuest - Whether this is a guest session
	 * @returns true if deleted, false if not found
	 */
	async clearBookingState(identifier: string, flightInstanceId: string, isGuest: boolean = false): Promise<boolean> {
		this.logger.log(`Clearing booking state for ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${flightInstanceId}`);
		return await this.bookingStateRepository.delete(identifier, flightInstanceId, isGuest);
	}

	/**
	 * Clear all booking states for a user or guest session (cleanup)
	 * 
	 * @param identifier - User ID (authenticated) or session ID (guest)
	 * @param isGuest - Whether this is a guest session
	 * @returns Number of deleted states
	 */
	async clearAllStates(identifier: string, isGuest: boolean = false): Promise<number> {
		this.logger.log(`Clearing all booking states for ${isGuest ? 'guest session' : 'user'} ${identifier}`);
		return await this.bookingStateRepository.deleteAllByIdentifier(identifier, isGuest);
	}

	/**
	 * Clear all booking states for a user (backward compatibility)
	 * 
	 * @param userId - User ID
	 * @returns Number of deleted states
	 */
	async clearAllUserStates(userId: string): Promise<number> {
		return this.clearAllStates(userId, false);
	}

	/**
	 * Check if booking state exists
	 */
	async exists(identifier: string, flightInstanceId: string, isGuest: boolean = false): Promise<boolean> {
		return await this.bookingStateRepository.exists(identifier, flightInstanceId, isGuest);
	}

	/**
	 * Get TTL for booking state
	 */
	async getTtl(identifier: string, flightInstanceId: string, isGuest: boolean = false): Promise<number> {
		return await this.bookingStateRepository.getTtl(identifier, flightInstanceId, isGuest);
	}

	/**
	 * Get all booking states for a user or guest session
	 * Useful for frontend to get flightInstanceId without storing in session
	 * 
	 * @param identifier - User ID (authenticated) or session ID (guest)
	 * @param isGuest - Whether this is a guest session
	 * @returns Array of booking states with flightInstanceId
	 */
	async getAllBookingStates(identifier: string, isGuest: boolean = false): Promise<Array<{ flightInstanceId: string; state: BookingState }>> {
		this.logger.log(`Getting all booking states for ${isGuest ? 'guest session' : 'user'} ${identifier}`);
		return await this.bookingStateRepository.findAllByIdentifier(identifier, isGuest);
	}
}

