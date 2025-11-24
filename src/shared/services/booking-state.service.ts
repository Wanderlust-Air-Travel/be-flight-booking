import { Injectable, Logger } from '@nestjs/common';
import { BookingStateRepository } from '../repositories/booking-state.repository';
import { CabinSelection, SeatSelection, BookingState } from '../types/booking-state.types';
import {
	BookingStateNotFoundException,
	CabinNotSelectedException,
	SeatNotSelectedException,
	InvalidFareClassException,
} from '../exceptions/booking-state.exceptions';

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
	 * @param userId - User ID
	 * @param cabinSelection - Cabin selection data
	 * @returns Success response
	 * @throws InvalidFareClassException if fare class code doesn't match cabin type
	 */
	async saveCabinSelection(
		userId: string,
		cabinSelection: CabinSelection,
	): Promise<{ success: boolean; message: string }> {
		this.logger.log(`Saving cabin selection for user ${userId}, flight ${cabinSelection.flightInstanceId}`);

		// Business rule: Validate fare class code matches cabin type
		// Economy fare classes start with 'Y' (e.g., 'YS', 'YF', 'YSM')
		// Business fare classes start with 'J' (e.g., 'JS', 'JF', 'JFLX')
		const fareClassCode = cabinSelection.fareClassCode.toUpperCase();
		const expectedPrefix = cabinSelection.cabinType === 'economy' ? 'Y' : 'J';
		
		if (!fareClassCode.startsWith(expectedPrefix)) {
			this.logger.warn(
				`Invalid fare class code '${fareClassCode}' for cabin type '${cabinSelection.cabinType}' for user ${userId}, flight ${cabinSelection.flightInstanceId}`
			);
			throw new InvalidFareClassException(fareClassCode, cabinSelection.cabinType);
		}

		// Get existing state or create new
		let state = await this.bookingStateRepository.findOne(userId, cabinSelection.flightInstanceId);
		
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
		await this.bookingStateRepository.save(userId, cabinSelection.flightInstanceId, state);

		this.logger.log(`Cabin selection saved successfully for user ${userId}, flight ${cabinSelection.flightInstanceId}`);
		
		return {
			success: true,
			message: 'Cabin selection saved successfully',
		};
	}

	/**
	 * Save seat selection to Redis
	 * Business logic: Validates cabin is selected first, then updates seat selection
	 * 
	 * @param userId - User ID
	 * @param seatSelection - Seat selection data
	 * @returns Success response
	 * @throws CabinNotSelectedException if cabin is not selected
	 */
	async saveSeatSelection(
		userId: string,
		seatSelection: SeatSelection,
	): Promise<{ success: boolean; message: string }> {
		this.logger.log(`Saving seat selection for user ${userId}, flight ${seatSelection.flightInstanceId}`);

		// Get existing state or create new
		let state = await this.bookingStateRepository.findOne(userId, seatSelection.flightInstanceId);
		
		if (!state) {
			state = {
				flightInstanceId: seatSelection.flightInstanceId,
				updatedAt: new Date(),
			};
		}

		// Business rule: Cabin must be selected before seat
		if (!state.cabin) {
			this.logger.warn(`Attempted to save seat without cabin for user ${userId}, flight ${seatSelection.flightInstanceId}`);
			throw new CabinNotSelectedException(seatSelection.flightInstanceId);
		}

		// Update seat selection
		state.seat = seatSelection;
		state.updatedAt = new Date();

		// Save to Redis via repository
		await this.bookingStateRepository.save(userId, seatSelection.flightInstanceId, state);

		this.logger.log(`Seat selection saved successfully for user ${userId}, flight ${seatSelection.flightInstanceId}`);
		
		return {
			success: true,
			message: 'Seat selection saved successfully',
		};
	}

	/**
	 * Get current booking state from Redis
	 * 
	 * @param userId - User ID
	 * @param flightInstanceId - Flight instance ID
	 * @returns BookingState or null if not found
	 */
	async getBookingState(userId: string, flightInstanceId: string): Promise<BookingState | null> {
		return await this.bookingStateRepository.findOne(userId, flightInstanceId);
	}

	/**
	 * Get cabin and seat selection for creating reservation
	 * Business logic: Validates both cabin and seat are selected
	 * 
	 * @param userId - User ID
	 * @param flightInstanceId - Flight instance ID
	 * @returns Cabin and seat selections
	 * @throws BookingStateNotFoundException if state not found
	 * @throws CabinNotSelectedException if cabin not selected
	 * @throws SeatNotSelectedException if seat not selected
	 */
	async getSelectionsForReservation(
		userId: string,
		flightInstanceId: string,
	): Promise<{ cabin: CabinSelection; seat: SeatSelection }> {
		this.logger.log(`Getting selections for reservation: user ${userId}, flight ${flightInstanceId}`);

		const state = await this.getBookingState(userId, flightInstanceId);
		
		if (!state) {
			this.logger.warn(`Booking state not found for user ${userId}, flight ${flightInstanceId}`);
			throw new BookingStateNotFoundException(flightInstanceId);
		}

		if (!state.cabin) {
			this.logger.warn(`Cabin not selected for user ${userId}, flight ${flightInstanceId}`);
			throw new CabinNotSelectedException(flightInstanceId);
		}

		if (!state.seat) {
			this.logger.warn(`Seat not selected for user ${userId}, flight ${flightInstanceId}`);
			throw new SeatNotSelectedException(flightInstanceId);
		}

		this.logger.log(`Selections retrieved successfully for user ${userId}, flight ${flightInstanceId}`);
		
		return {
			cabin: state.cabin,
			seat: state.seat,
		};
	}

	/**
	 * Clear booking state (after successful reservation or cancellation)
	 * 
	 * @param userId - User ID
	 * @param flightInstanceId - Flight instance ID
	 * @returns true if deleted, false if not found
	 */
	async clearBookingState(userId: string, flightInstanceId: string): Promise<boolean> {
		this.logger.log(`Clearing booking state for user ${userId}, flight ${flightInstanceId}`);
		return await this.bookingStateRepository.delete(userId, flightInstanceId);
	}

	/**
	 * Clear all booking states for a user (cleanup)
	 * 
	 * @param userId - User ID
	 * @returns Number of deleted states
	 */
	async clearAllUserStates(userId: string): Promise<number> {
		this.logger.log(`Clearing all booking states for user ${userId}`);
		return await this.bookingStateRepository.deleteAllByUserId(userId);
	}

	/**
	 * Check if booking state exists
	 */
	async exists(userId: string, flightInstanceId: string): Promise<boolean> {
		return await this.bookingStateRepository.exists(userId, flightInstanceId);
	}

	/**
	 * Get TTL for booking state
	 */
	async getTtl(userId: string, flightInstanceId: string): Promise<number> {
		return await this.bookingStateRepository.getTtl(userId, flightInstanceId);
	}

	/**
	 * Get all booking states for a user
	 * Useful for frontend to get flightInstanceId without storing in session
	 * 
	 * @param userId - User ID
	 * @returns Array of booking states with flightInstanceId
	 */
	async getAllBookingStates(userId: string): Promise<Array<{ flightInstanceId: string; state: BookingState }>> {
		this.logger.log(`Getting all booking states for user ${userId}`);
		return await this.bookingStateRepository.findAllByUserId(userId);
	}
}

