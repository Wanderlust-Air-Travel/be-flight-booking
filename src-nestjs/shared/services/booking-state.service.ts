import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
    BookingStateNotFoundException,
    CabinNotSelectedException,
    InvalidFareClassException,
    SeatNotSelectedException,
} from '../exceptions/booking-state.exceptions';
import { BookingStateRepository } from '../repositories/booking-state.repository';
import type {
    BookingState,
    CabinSelection,
    SeatSelection,
    SeatSelectionItem,
    SelectedCabinService,
} from '../types/booking-state.types';

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
        isGuest = false
    ): Promise<{ success: boolean; message: string }> {
        // Defensive validation: ensure required fields are present before processing
        // This protects against malformed requests that bypass DTO validation (e.g. direct API calls,
        // or clients sending undefined/null values for required fields)
        if (!cabinSelection || typeof cabinSelection !== 'object') {
            this.logger.warn(
                `Missing cabin selection payload for ${isGuest ? 'guest session' : 'user'} ${identifier}`
            );
            throw new BadRequestException('Cabin selection payload is required.');
        }
        if (!cabinSelection.fareClassCode || typeof cabinSelection.fareClassCode !== 'string') {
            this.logger.warn(
                `Missing or invalid fareClassCode for ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${cabinSelection.flightInstanceId}`
            );
            throw new BadRequestException('fareClassCode is required and must be a non-empty string.');
        }
        if (!cabinSelection.cabinType || typeof cabinSelection.cabinType !== 'string') {
            this.logger.warn(
                `Missing or invalid cabinType for ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${cabinSelection.flightInstanceId}`
            );
            throw new BadRequestException('cabinType is required and must be a non-empty string.');
        }
        if (!cabinSelection.flightInstanceId || typeof cabinSelection.flightInstanceId !== 'string') {
            this.logger.warn(
                `Missing or invalid flightInstanceId for ${isGuest ? 'guest session' : 'user'} ${identifier}`
            );
            throw new BadRequestException('flightInstanceId is required and must be a non-empty string.');
        }

        this.logger.log(
            `Saving cabin selection for ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${cabinSelection.flightInstanceId}`
        );

        // Business rule: Validate fare class code matches cabin type
        // Economy fare classes start with 'Y' (e.g., 'YS', 'YF', 'YSM')
        // Business fare classes start with 'J' (e.g., 'JS', 'JF', 'JFLX')
        const fareClassCode = cabinSelection.fareClassCode.toUpperCase().trim();
        const expectedPrefix = cabinSelection.cabinType === 'economy' ? 'Y' : 'J';

        if (!fareClassCode.startsWith(expectedPrefix)) {
            this.logger.warn(
                `Invalid fare class code '${fareClassCode}' for cabin type '${cabinSelection.cabinType}' for ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${cabinSelection.flightInstanceId}`
            );
            throw new InvalidFareClassException(fareClassCode, cabinSelection.cabinType);
        }

        // Get existing state or create new
        let state = await this.bookingStateRepository.findOne(
            identifier,
            cabinSelection.flightInstanceId,
            isGuest
        );

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
        await this.bookingStateRepository.save(
            identifier,
            cabinSelection.flightInstanceId,
            state,
            isGuest
        );

        this.logger.log(
            `Cabin selection saved successfully for ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${cabinSelection.flightInstanceId}`
        );

        return {
            success: true,
            message: 'Cabin selection saved successfully',
        };
    }

    /**
     * Save seat selection to Redis
     * Business logic: Validates cabin is selected first, then updates seat selection
     * Supports both single seat (backward compatibility) and multiple seats
     *
     * @param identifier - User ID (authenticated) or session ID (guest)
     * @param seatSelection - Seat selection data (single seat for backward compatibility)
     * @param seats - Array of seat selections (preferred for multiple passengers)
     * @param isGuest - Whether this is a guest session
     * @returns Success response
     * @throws CabinNotSelectedException if cabin is not selected
     */
    async saveSeatSelection(
        identifier: string,
        seatSelection: SeatSelection | null,
        seats: SeatSelectionItem[] | null = null,
        isGuest = false
    ): Promise<{ success: boolean; message: string }> {
        const flightInstanceId =
            seatSelection?.flightInstanceId || (seats && seats.length > 0 ? null : null);

        if (!flightInstanceId && !seats) {
            throw new Error('Either seatSelection or seats array must be provided');
        }

        // Determine flightInstanceId from seats if not provided in seatSelection
        const actualFlightInstanceId =
            seatSelection?.flightInstanceId || (seats && seats.length > 0 ? null : null);

        if (!actualFlightInstanceId) {
            throw new Error('Flight instance ID is required');
        }

        this.logger.log(
            `Saving seat selection for ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${actualFlightInstanceId}, seats count: ${seats?.length || (seatSelection ? 1 : 0)}`
        );

        // Get existing state or create new
        let state = await this.bookingStateRepository.findOne(
            identifier,
            actualFlightInstanceId,
            isGuest
        );

        if (!state) {
            state = {
                flightInstanceId: actualFlightInstanceId,
                updatedAt: new Date(),
            };
        }

        // Business rule: Cabin must be selected before seat
        if (!state.cabin) {
            this.logger.warn(
                `Attempted to save seat without cabin for ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${actualFlightInstanceId}`
            );
            throw new CabinNotSelectedException(actualFlightInstanceId);
        }

        // Update seat selection: prefer seats array, fallback to single seat for backward compatibility
        if (seats && seats.length > 0) {
            state.seats = seats;
            // Also set single seat for backward compatibility (use first seat)
            if (seatSelection) {
                state.seat = seatSelection;
            } else {
                state.seat = {
                    flightInstanceId: actualFlightInstanceId,
                    flightSeatId: seats[0].flightSeatId,
                    seatNumber: seats[0].seatNumber,
                };
            }
        } else if (seatSelection) {
            // Backward compatibility: single seat
            state.seat = seatSelection;
            // Convert to seats array
            state.seats = [
                {
                    flightSeatId: seatSelection.flightSeatId,
                    seatNumber: seatSelection.seatNumber,
                },
            ];
        } else {
            throw new Error('Either seatSelection or seats array must be provided');
        }

        state.updatedAt = new Date();

        // Save to Redis via repository
        await this.bookingStateRepository.save(identifier, actualFlightInstanceId, state, isGuest);

        this.logger.log(
            `Seat selection saved successfully for ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${actualFlightInstanceId}, ${state.seats?.length || 1} seat(s)`
        );

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
    async getBookingState(
        identifier: string,
        flightInstanceId: string,
        isGuest = false
    ): Promise<BookingState | null> {
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
        isGuest = false
    ): Promise<{ cabin: CabinSelection; seat: SeatSelection; seats: SeatSelectionItem[] }> {
        this.logger.log(
            `Getting selections for reservation: ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${flightInstanceId}`
        );

        const state = await this.getBookingState(identifier, flightInstanceId, isGuest);

        if (!state) {
            this.logger.warn(
                `Booking state not found for ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${flightInstanceId}`
            );
            throw new BookingStateNotFoundException(flightInstanceId);
        }

        if (!state.cabin) {
            this.logger.warn(
                `Cabin not selected for ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${flightInstanceId}`
            );
            throw new CabinNotSelectedException(flightInstanceId);
        }

        // Check for seats array first (preferred), fallback to single seat
        if (!state.seats && !state.seat) {
            this.logger.warn(
                `Seat not selected for ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${flightInstanceId}`
            );
            throw new SeatNotSelectedException(flightInstanceId);
        }

        // Convert single seat to seats array if needed (backward compatibility)
        const seats =
            state.seats ||
            (state.seat
                ? [
                      {
                          flightSeatId: state.seat.flightSeatId,
                          seatNumber: state.seat.seatNumber,
                      },
                  ]
                : []);

        // Ensure seat is set for backward compatibility
        const seat =
            state.seat ||
            (seats.length > 0
                ? {
                      flightInstanceId,
                      flightSeatId: seats[0].flightSeatId,
                      seatNumber: seats[0].seatNumber,
                  }
                : null);

        if (!seat) {
            throw new SeatNotSelectedException(flightInstanceId);
        }

        this.logger.log(
            `Selections retrieved successfully for ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${flightInstanceId}, ${seats.length} seat(s)`
        );

        return {
            cabin: state.cabin,
            seat,
            seats,
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
    async clearBookingState(
        identifier: string,
        flightInstanceId: string,
        isGuest = false
    ): Promise<boolean> {
        this.logger.log(
            `Clearing booking state for ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${flightInstanceId}`
        );
        return await this.bookingStateRepository.delete(identifier, flightInstanceId, isGuest);
    }

    /**
     * Clear all booking states for a user or guest session (cleanup)
     *
     * @param identifier - User ID (authenticated) or session ID (guest)
     * @param isGuest - Whether this is a guest session
     * @returns Number of deleted states
     */
    async clearAllStates(identifier: string, isGuest = false): Promise<number> {
        this.logger.log(
            `Clearing all booking states for ${isGuest ? 'guest session' : 'user'} ${identifier}`
        );
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
    async exists(identifier: string, flightInstanceId: string, isGuest = false): Promise<boolean> {
        return await this.bookingStateRepository.exists(identifier, flightInstanceId, isGuest);
    }

    /**
     * Get TTL for booking state
     */
    async getTtl(identifier: string, flightInstanceId: string, isGuest = false): Promise<number> {
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
    async getAllBookingStates(
        identifier: string,
        isGuest = false
    ): Promise<Array<{ flightInstanceId: string; state: BookingState }>> {
        this.logger.log(
            `Getting all booking states for ${isGuest ? 'guest session' : 'user'} ${identifier}`
        );
        return await this.bookingStateRepository.findAllByIdentifier(identifier, isGuest);
    }

    /**
     * Save selected cabin services to Redis
     * Business logic: Validates cabin is selected first, then updates selected services
     *
     * @param identifier - User ID (authenticated) or session ID (guest)
     * @param flightInstanceId - Flight instance ID
     * @param services - Array of selected cabin services
     * @param isGuest - Whether this is a guest session
     * @returns Success response
     * @throws CabinNotSelectedException if cabin is not selected
     */
    async saveCabinServices(
        identifier: string,
        flightInstanceId: string,
        services: SelectedCabinService[],
        isGuest = false
    ): Promise<{ success: boolean; message: string }> {
        this.logger.log(
            `Saving cabin services for ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${flightInstanceId}, ${services.length} service(s)`
        );

        // Get existing state or create new
        let state = await this.bookingStateRepository.findOne(
            identifier,
            flightInstanceId,
            isGuest
        );

        if (!state) {
            state = {
                flightInstanceId,
                updatedAt: new Date(),
            };
        }

        // Validate cabin is selected
        if (!state.cabin) {
            this.logger.warn(
                `Cabin not selected for ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${flightInstanceId}`
            );
            throw new CabinNotSelectedException(flightInstanceId);
        }

        // Update selected services
        state.selectedServices = services;
        state.updatedAt = new Date();

        // Save to Redis via repository
        await this.bookingStateRepository.save(identifier, flightInstanceId, state, isGuest);

        this.logger.log(
            `Cabin services saved successfully for ${isGuest ? 'guest session' : 'user'} ${identifier}, flight ${flightInstanceId}`
        );

        return {
            success: true,
            message: 'Cabin services saved successfully',
        };
    }
}
